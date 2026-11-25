from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_user, get_optional_user
from utils.cache import invalidate_content_caches

router = APIRouter(prefix="/ratings", tags=["Ratings (Seri Puanları)"])

VALID_CONTENT_TYPES = ("webtoon", "novel")


class RatingIn(BaseModel):
    score: int


def _resolve_series(db: Session, content_type: str, series_id: int):
    normalized = (content_type or "").strip().lower()
    if normalized not in VALID_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz içerik türü. Yalnızca 'webtoon' veya 'novel' desteklenir.",
        )
    if series_id < 1:
        raise HTTPException(status_code=400, detail="Geçersiz seri kimliği.")

    model = models.Webtoon if normalized == "webtoon" else models.Novel
    series = db.query(model).filter(model.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Seri bulunamadı.")
    return normalized, series


def _recalculate_series_rating(db: Session, content_type: str, series) -> tuple[float, int]:
    agg = (
        db.query(
            func.avg(models.SeriesRating.score),
            func.count(models.SeriesRating.id),
        )
        .filter(
            models.SeriesRating.content_type == content_type,
            models.SeriesRating.series_id == series.id,
        )
        .first()
    )
    raw_avg, raw_count = agg if agg else (None, 0)
    count = int(raw_count or 0)
    avg = round(float(raw_avg), 2) if count > 0 and raw_avg is not None else 0.0

    series.rating_avg = avg
    series.rating_count = count
    return avg, count


def _get_user_score(
    db: Session,
    content_type: str,
    series_id: int,
    user: Optional[models.User],
) -> Optional[int]:
    if not user:
        return None
    existing = (
        db.query(models.SeriesRating.score)
        .filter(
            models.SeriesRating.user_id == user.id,
            models.SeriesRating.content_type == content_type,
            models.SeriesRating.series_id == series_id,
        )
        .first()
    )
    return int(existing[0]) if existing else None


@router.get("/{content_type}/{series_id}")
def get_series_rating(
    content_type: str,
    series_id: int,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Serinin ortalama puanını, oy sayısını ve (varsa) kullanıcının verdiği puanı döner."""
    normalized, series = _resolve_series(db, content_type, series_id)
    rating_count = int(getattr(series, "rating_count", 0) or 0)
    rating_avg = round(float(getattr(series, "rating_avg", 0.0) or 0.0), 2) if rating_count > 0 else 0.0
    user_rating = _get_user_score(db, normalized, series.id, user)
    return {
        "rating_avg": rating_avg,
        "rating_count": rating_count,
        "user_rating": user_rating,
    }


@router.post("/{content_type}/{series_id}")
def upsert_series_rating(
    content_type: str,
    series_id: int,
    payload: RatingIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının 1-5 arası seri puanını kaydeder veya günceller."""
    normalized, series = _resolve_series(db, content_type, series_id)
    if isinstance(payload.score, bool) or payload.score < 1 or payload.score > 5:
        raise HTTPException(status_code=400, detail="Puan 1 ile 5 arasında tam sayı olmalıdır.")

    now = datetime.utcnow()
    existing = (
        db.query(models.SeriesRating)
        .filter(
            models.SeriesRating.user_id == user.id,
            models.SeriesRating.content_type == normalized,
            models.SeriesRating.series_id == series.id,
        )
        .first()
    )
    if existing:
        existing.score = int(payload.score)
        existing.updated_at = now
    else:
        db.add(
            models.SeriesRating(
                user_id=user.id,
                content_type=normalized,
                series_id=series.id,
                score=int(payload.score),
                created_at=now,
                updated_at=now,
            )
        )

    db.flush()
    avg, count = _recalculate_series_rating(db, normalized, series)
    db.commit()
    invalidate_content_caches()

    return {
        "rating_avg": avg,
        "rating_count": count,
        "user_rating": int(payload.score),
    }


@router.delete("/{content_type}/{series_id}")
def delete_series_rating(
    content_type: str,
    series_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının seriye verdiği puanı siler ve seri ortalamasını yeniden hesaplar."""
    normalized, series = _resolve_series(db, content_type, series_id)
    existing = (
        db.query(models.SeriesRating)
        .filter(
            models.SeriesRating.user_id == user.id,
            models.SeriesRating.content_type == normalized,
            models.SeriesRating.series_id == series.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    avg, count = _recalculate_series_rating(db, normalized, series)
    db.commit()
    invalidate_content_caches()

    return {
        "rating_avg": avg,
        "rating_count": count,
        "user_rating": None,
    }
