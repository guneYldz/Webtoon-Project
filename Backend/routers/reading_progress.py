import datetime
import time
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user
import models
from utils.chapter_title import clean_chapter_number
from utils.query_helpers import parse_pg_int

router = APIRouter(
    prefix="/reading-progress",
    tags=["Reading Progress (Okuma Geçmişi)"],
)

MAX_HISTORY_ITEMS = 30
MAX_READ_CHAPTER_IDS = 500


def _normalize_series_type(content_type: str, raw: Optional[str]) -> str:
    upper = str(raw or "").strip().upper()
    if upper in ("WEBTOON", "MANGA", "NOVEL"):
        return upper
    return "NOVEL" if content_type == "novel" else "WEBTOON"


def _clamp_scroll(value: Any) -> int:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return 0
    if num != num:  # NaN
        return 0
    return max(0, min(100, int(round(num))))


def _merge_read_ids(existing: Optional[List[Any]], incoming: Optional[List[Any]]) -> List[Any]:
    seen = set()
    merged: List[Any] = []
    for source in (existing or []), (incoming or []):
        if not isinstance(source, list):
            continue
        for item in source:
            if item is None or item == "":
                continue
            key = str(item)
            if key not in seen:
                seen.add(key)
                merged.append(item)
    if len(merged) > MAX_READ_CHAPTER_IDS:
        merged = merged[-MAX_READ_CHAPTER_IDS:]
    return merged


def _to_dto(row: models.UserReadingProgress) -> dict:
    return {
        "type": row.content_type,
        "seriesType": row.series_type,
        "seriesId": row.series_id,
        "slug": row.slug or "",
        "title": row.title or "",
        "coverImage": row.cover_image or "",
        "lastChapterId": row.last_chapter_id,
        "lastChapterNumber": (
            clean_chapter_number(row.last_chapter_number)
            if row.last_chapter_number is not None
            else None
        ),
        "lastChapterTitle": row.last_chapter_title,
        "lastChapterUrl": row.last_chapter_url or "",
        "scrollPct": int(row.scroll_pct or 0),
        "readChapterIds": list(row.read_chapter_ids or []),
        "updatedAt": int(row.updated_at_ms or 0),
    }


def _fetch_top_progress(db: Session, user_id: int) -> List[dict]:
    rows = (
        db.query(models.UserReadingProgress)
        .filter(models.UserReadingProgress.user_id == user_id)
        .order_by(
            desc(models.UserReadingProgress.updated_at_ms),
            desc(models.UserReadingProgress.updated_at),
            desc(models.UserReadingProgress.id),
        )
        .limit(MAX_HISTORY_ITEMS)
        .all()
    )
    return [_to_dto(r) for r in rows]


def _normalize_item(raw: Any, *, strict: bool = False) -> Optional[dict]:
    if not isinstance(raw, dict):
        if strict:
            raise HTTPException(status_code=400, detail="Geçersiz okuma ilerlemesi nesnesi.")
        return None

    c_type = str(raw.get("type") or raw.get("content_type") or "").strip().lower()
    if c_type not in ("webtoon", "novel"):
        if strict:
            raise HTTPException(status_code=400, detail="type yalnızca 'webtoon' veya 'novel' olabilir.")
        return None

    s_id = parse_pg_int(str(raw.get("seriesId") if raw.get("seriesId") is not None else raw.get("series_id", "")))
    if s_id is None:
        if strict:
            raise HTTPException(status_code=400, detail="Geçersiz seriesId.")
        return None

    last_ch_id = None
    raw_ch_id = raw.get("lastChapterId")
    if raw_ch_id is not None and raw_ch_id != "":
        last_ch_id = parse_pg_int(str(raw_ch_id))

    last_ch_num = None
    raw_ch_num = raw.get("lastChapterNumber")
    if raw_ch_num is not None and raw_ch_num != "":
        try:
            fnum = float(raw_ch_num)
            if fnum == fnum and abs(fnum) != float("inf"):
                last_ch_num = fnum
        except (TypeError, ValueError):
            last_ch_num = None

    raw_ts = raw.get("updatedAt")
    try:
        updated_ms = int(raw_ts) if raw_ts is not None else 0
    except (TypeError, ValueError):
        updated_ms = 0
    if updated_ms <= 0:
        updated_ms = int(time.time() * 1000)

    slug = str(raw.get("slug") or "")[:255]
    title = str(raw.get("title") or "")[:255]
    cover = str(raw.get("coverImage") or "")[:500]
    ch_title = raw.get("lastChapterTitle")
    if ch_title is not None:
        ch_title = str(ch_title)[:255]
    ch_url = str(raw.get("lastChapterUrl") or "")[:500]
    read_ids = raw.get("readChapterIds")
    if not isinstance(read_ids, list):
        read_ids = []

    return {
        "content_type": c_type,
        "series_type": _normalize_series_type(c_type, raw.get("seriesType")),
        "series_id": s_id,
        "slug": slug,
        "title": title,
        "cover_image": cover,
        "last_chapter_id": last_ch_id,
        "last_chapter_number": last_ch_num,
        "last_chapter_title": ch_title,
        "last_chapter_url": ch_url,
        "scroll_pct": _clamp_scroll(raw.get("scrollPct")),
        "read_chapter_ids": _merge_read_ids([], read_ids),
        "updated_at_ms": updated_ms,
    }


@router.get("")
@router.get("/", include_in_schema=False)
def get_reading_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {"items": _fetch_top_progress(db, current_user.id)}


@router.post("/sync")
def sync_reading_progress(
    payload: Any = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Geçersiz senkronizasyon gövdesi.")

    if "items" in payload:
        raw_items = payload.get("items")
        if not isinstance(raw_items, list):
            raise HTTPException(status_code=400, detail="'items' bir liste olmalıdır.")
        normalized_items = [
            item for item in (_normalize_item(x, strict=False) for x in raw_items[:MAX_HISTORY_ITEMS])
            if item is not None
        ]
    else:
        normalized_items = [_normalize_item(payload, strict=True)]  # type: ignore[list-item]

    if normalized_items:
        existing_rows = (
            db.query(models.UserReadingProgress)
            .filter(models.UserReadingProgress.user_id == current_user.id)
            .all()
        )
        by_key: dict[Tuple[str, int], models.UserReadingProgress] = {
            (r.content_type, int(r.series_id)): r for r in existing_rows
        }
        now_utc = datetime.datetime.utcnow()

        for item in normalized_items:
            key = (item["content_type"], int(item["series_id"]))
            existing = by_key.get(key)

            if existing is None:
                row = models.UserReadingProgress(
                    user_id=current_user.id,
                    content_type=item["content_type"],
                    series_type=item["series_type"],
                    series_id=item["series_id"],
                    slug=item["slug"],
                    title=item["title"],
                    cover_image=item["cover_image"],
                    last_chapter_id=item["last_chapter_id"],
                    last_chapter_number=item["last_chapter_number"],
                    last_chapter_title=item["last_chapter_title"],
                    last_chapter_url=item["last_chapter_url"],
                    scroll_pct=item["scroll_pct"],
                    read_chapter_ids=item["read_chapter_ids"],
                    updated_at_ms=item["updated_at_ms"],
                    created_at=now_utc,
                    updated_at=now_utc,
                )
                db.add(row)
                by_key[key] = row
            else:
                existing.read_chapter_ids = _merge_read_ids(
                    existing.read_chapter_ids, item["read_chapter_ids"]
                )
                if item["updated_at_ms"] >= int(existing.updated_at_ms or 0):
                    existing.series_type = item["series_type"]
                    if item["slug"]:
                        existing.slug = item["slug"]
                    if item["title"]:
                        existing.title = item["title"]
                    if item["cover_image"]:
                        existing.cover_image = item["cover_image"]
                    existing.last_chapter_id = item["last_chapter_id"]
                    existing.last_chapter_number = item["last_chapter_number"]
                    existing.last_chapter_title = item["last_chapter_title"]
                    if item["last_chapter_url"]:
                        existing.last_chapter_url = item["last_chapter_url"]
                    existing.scroll_pct = item["scroll_pct"]
                    existing.updated_at_ms = item["updated_at_ms"]
                    existing.updated_at = now_utc

        db.commit()

    return {"items": _fetch_top_progress(db, current_user.id)}


@router.delete("/{content_type}/{series_id}")
def delete_series_reading_progress(
    content_type: str,
    series_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    c_type = (content_type or "").strip().lower()
    if c_type not in ("webtoon", "novel"):
        raise HTTPException(status_code=400, detail="Geçersiz içerik türü.")

    (
        db.query(models.UserReadingProgress)
        .filter(
            models.UserReadingProgress.user_id == current_user.id,
            models.UserReadingProgress.content_type == c_type,
            models.UserReadingProgress.series_id == series_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"ok": True}


@router.delete("")
@router.delete("/", include_in_schema=False)
def clear_reading_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    (
        db.query(models.UserReadingProgress)
        .filter(models.UserReadingProgress.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"ok": True}
