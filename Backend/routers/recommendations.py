import math
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
from utils.cache import recommendations_cache
from utils.query_helpers import parse_pg_int

router = APIRouter(
    prefix="/recommendations",
    tags=["Recommendations (Akıllı Öneriler)"],
)


def _find_target_series(db: Session, series_type: str, series_key: str):
    clean_key = (series_key or "").strip()
    model = models.Webtoon if series_type == "webtoon" else models.Novel

    q = db.query(model).options(selectinload(model.categories)).filter(model.is_published == True)
    if clean_key.isdigit():
        parsed_id = parse_pg_int(clean_key)
        if parsed_id is None:
            return None
        return q.filter(model.id == parsed_id).first()

    item = q.filter(model.slug == clean_key).first()
    if not item and clean_key:
        item = q.filter(func.trim(func.lower(model.slug)) == clean_key.lower()).first()
    return item


def _card_type_label(s_type: str, obj) -> str:
    if s_type == "novel":
        return "NOVEL"
    raw = str(getattr(getattr(obj, "type", None), "value", getattr(obj, "type", "WEBTOON")) or "WEBTOON").upper()
    return "MANGA" if raw == "MANGA" else "WEBTOON"


def _score_candidates(
    db: Session,
    *,
    cand_type: str,
    exclude_id: Optional[int],
    target_cat_ids: Set[int],
    target_fav_user_ids: List[int],
) -> List[Tuple[float, int, int, dict]]:
    model = models.Webtoon if cand_type == "webtoon" else models.Novel
    fav_col = models.Favorite.webtoon_id if cand_type == "webtoon" else models.Favorite.novel_id

    cand_q = db.query(model).options(selectinload(model.categories)).filter(model.is_published == True)
    if exclude_id is not None:
        cand_q = cand_q.filter(model.id != exclude_id)
    candidates = cand_q.all()
    if not candidates:
        return []

    co_fav_map: Dict[int, int] = {}
    if target_fav_user_ids:
        co_q = db.query(
            fav_col.label("series_id"),
            func.count(func.distinct(models.Favorite.user_id)).label("cnt"),
        ).filter(
            models.Favorite.user_id.in_(target_fav_user_ids),
            fav_col.isnot(None),
        )
        if exclude_id is not None:
            co_q = co_q.filter(fav_col != exclude_id)
        for row in co_q.group_by(fav_col).all():
            co_fav_map[int(row.series_id)] = int(row.cnt or 0)

    scored: List[Tuple[float, int, int, dict]] = []
    for c in candidates:
        cand_cats = c.categories or []
        cand_cat_ids = {cat.id for cat in cand_cats}
        shared_cats = len(target_cat_ids & cand_cat_ids) if target_cat_ids else 0
        co_favs = co_fav_map.get(int(c.id), 0)
        views = max(0, int(getattr(c, "view_count", 0) or 0))
        score = (shared_cats * 3.0) + (co_favs * 2.0) + min(math.log1p(views), 3.0)

        card = {
            "id": c.id,
            "slug": c.slug,
            "title": c.title or "",
            "cover_image": c.cover_image,
            "type": cand_type,
            "typeLabel": _card_type_label(cand_type, c),
            "status": c.status or "ongoing",
            "view_count": views,
            "categories": [{"id": cat.id, "name": cat.name} for cat in cand_cats],
        }
        scored.append((score, views, int(c.id), card))

    scored.sort(key=lambda item: (-item[0], -item[1], -item[2]))
    return scored


@router.get("/{series_type}/{series_key}")
def get_recommendations(
    series_type: str,
    series_key: str,
    limit: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    s_type = (series_type or "").strip().lower()
    if s_type not in ("webtoon", "novel"):
        raise HTTPException(status_code=400, detail="series_type yalnızca 'webtoon' veya 'novel' olabilir.")

    target = _find_target_series(db, s_type, series_key)
    if not target:
        raise HTTPException(status_code=404, detail="Seri bulunamadı.")

    cache_key = f"{s_type}:{target.id}:{limit}"
    cached = recommendations_cache.get(cache_key)
    if cached is not None:
        return cached

    target_cat_ids = {c.id for c in (target.categories or [])}
    target_fav_col = models.Favorite.webtoon_id if s_type == "webtoon" else models.Favorite.novel_id
    fav_user_rows = (
        db.query(models.Favorite.user_id)
        .filter(
            target_fav_col == target.id,
            models.Favorite.user_id.isnot(None),
        )
        .distinct()
        .all()
    )
    target_fav_user_ids = [int(r.user_id) for r in fav_user_rows]

    same_scored = _score_candidates(
        db,
        cand_type=s_type,
        exclude_id=int(target.id),
        target_cat_ids=target_cat_ids,
        target_fav_user_ids=target_fav_user_ids,
    )
    results = [item[3] for item in same_scored[:limit]]

    if len(results) < limit:
        other_type = "novel" if s_type == "webtoon" else "webtoon"
        cross_scored = _score_candidates(
            db,
            cand_type=other_type,
            exclude_id=None,
            target_cat_ids=target_cat_ids,
            target_fav_user_ids=target_fav_user_ids,
        )
        needed = limit - len(results)
        results.extend(item[3] for item in cross_scored[:needed])

    recommendations_cache.set(cache_key, results)
    return results
