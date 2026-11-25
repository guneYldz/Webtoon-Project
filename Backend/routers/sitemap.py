from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from database import get_db
import models
from utils.chapter_title import format_chapter_number
from utils.query_helpers import to_utc_iso

router = APIRouter(tags=["SEO Sitemap"])


def _max_dt(a: Optional[datetime], b: Optional[datetime]) -> Optional[datetime]:
    if a is None:
        return b
    if b is None:
        return a
    return a if a >= b else b


def build_sitemap_payload(db: Session) -> dict:
    """Fetch lightweight column-only sitemap data for all published series and chapters/episodes."""
    novel_rows = (
        db.query(
            models.Novel.id,
            models.Novel.slug,
            models.Novel.created_at,
        )
        .filter(models.Novel.is_published == True)
        .order_by(models.Novel.id.asc())
        .all()
    )

    chapter_rows = (
        db.query(
            models.NovelChapter.novel_id,
            models.NovelChapter.chapter_number,
            models.NovelChapter.created_at,
        )
        .join(models.Novel, models.NovelChapter.novel_id == models.Novel.id)
        .filter(
            models.Novel.is_published == True,
            models.NovelChapter.is_published == True,
        )
        .order_by(
            models.NovelChapter.novel_id.asc(),
            models.NovelChapter.chapter_number.asc(),
        )
        .all()
    )

    chapters_by_novel: Dict[int, List[dict]] = defaultdict(list)
    novel_latest_chapter_dt: Dict[int, Optional[datetime]] = {}
    for novel_id, ch_num, ch_created in chapter_rows:
        chapters_by_novel[novel_id].append(
            {
                "chapter_number": format_chapter_number(ch_num),
                "created_at": to_utc_iso(ch_created),
            }
        )
        novel_latest_chapter_dt[novel_id] = _max_dt(
            novel_latest_chapter_dt.get(novel_id), ch_created
        )

    novels_out = []
    for n_id, n_slug, n_created in novel_rows:
        slug_val = (n_slug or "").strip() or str(n_id)
        latest_dt = _max_dt(n_created, novel_latest_chapter_dt.get(n_id))
        novels_out.append(
            {
                "id": n_id,
                "slug": slug_val,
                "updated_at": to_utc_iso(latest_dt),
                "created_at": to_utc_iso(n_created),
                "chapters": chapters_by_novel.get(n_id, []),
            }
        )

    webtoon_rows = (
        db.query(
            models.Webtoon.id,
            models.Webtoon.slug,
            models.Webtoon.created_at,
        )
        .filter(models.Webtoon.is_published == True)
        .order_by(models.Webtoon.id.asc())
        .all()
    )

    episode_rows = (
        db.query(
            models.WebtoonEpisode.id,
            models.WebtoonEpisode.webtoon_id,
            models.WebtoonEpisode.episode_number,
            models.WebtoonEpisode.created_at,
        )
        .join(models.Webtoon, models.WebtoonEpisode.webtoon_id == models.Webtoon.id)
        .filter(
            models.Webtoon.is_published == True,
            models.WebtoonEpisode.is_published == True,
        )
        .order_by(
            models.WebtoonEpisode.webtoon_id.asc(),
            models.WebtoonEpisode.episode_number.asc(),
        )
        .all()
    )

    episodes_by_webtoon: Dict[int, List[dict]] = defaultdict(list)
    webtoon_latest_ep_dt: Dict[int, Optional[datetime]] = {}
    for ep_id, w_id, ep_num, ep_created in episode_rows:
        episodes_by_webtoon[w_id].append(
            {
                "id": ep_id,
                "episode_number": format_chapter_number(ep_num),
                "created_at": to_utc_iso(ep_created),
            }
        )
        webtoon_latest_ep_dt[w_id] = _max_dt(
            webtoon_latest_ep_dt.get(w_id), ep_created
        )

    webtoons_out = []
    for w_id, w_slug, w_created in webtoon_rows:
        slug_val = (w_slug or "").strip() or str(w_id)
        latest_dt = _max_dt(w_created, webtoon_latest_ep_dt.get(w_id))
        webtoons_out.append(
            {
                "id": w_id,
                "slug": slug_val,
                "updated_at": to_utc_iso(latest_dt),
                "created_at": to_utc_iso(w_created),
                "episodes": episodes_by_webtoon.get(w_id, []),
            }
        )

    return {
        "novels": novels_out,
        "webtoons": webtoons_out,
    }


@router.get("/sitemap-data")
def get_sitemap_data(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=60"
    return build_sitemap_payload(db)
