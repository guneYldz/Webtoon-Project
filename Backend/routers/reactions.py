from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from database import get_db
from routers.auth import get_current_user, get_optional_user
import models

router = APIRouter(prefix="/reactions", tags=["Reactions (Tepkiler)"])

REACTION_KEYS = ("upvote", "funny", "love", "surprised", "angry", "sad")
CONTENT_TYPES = ("webtoon", "novel")


class ReactionIn(BaseModel):
    reaction: str


def _empty_counts():
    return {key: 0 for key in REACTION_KEYS}


def _validate_target(content_type: str, target_id: int, db: Session):
    if content_type not in CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz içerik türü")
    if content_type == "webtoon":
        item = db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.id == target_id).first()
    else:
        item = db.query(models.NovelChapter).filter(models.NovelChapter.id == target_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    return item


def _payload(db: Session, content_type: str, target_id: int, user: Optional[models.User]):
    rows = (
        db.query(models.ChapterReaction.reaction, func.count(models.ChapterReaction.id))
        .filter(
            models.ChapterReaction.content_type == content_type,
            models.ChapterReaction.target_id == target_id,
        )
        .group_by(models.ChapterReaction.reaction)
        .all()
    )
    counts = _empty_counts()
    for key, n in rows:
        if key in counts:
            counts[key] = int(n)
    mine = None
    if user:
        existing = (
            db.query(models.ChapterReaction)
            .filter(
                models.ChapterReaction.user_id == user.id,
                models.ChapterReaction.content_type == content_type,
                models.ChapterReaction.target_id == target_id,
            )
            .first()
        )
        if existing:
            mine = existing.reaction
    return {
        "counts": counts,
        "total": sum(counts.values()),
        "mine": mine,
    }


@router.get("/{content_type}/{target_id}")
def get_reactions(
    content_type: str,
    target_id: int,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_optional_user),
):
    _validate_target(content_type, target_id, db)
    return _payload(db, content_type, target_id, user)


@router.post("/{content_type}/{target_id}")
def toggle_reaction(
    content_type: str,
    target_id: int,
    body: ReactionIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _validate_target(content_type, target_id, db)
    if body.reaction not in REACTION_KEYS:
        raise HTTPException(status_code=400, detail="Geçersiz tepki")

    existing = (
        db.query(models.ChapterReaction)
        .filter(
            models.ChapterReaction.user_id == user.id,
            models.ChapterReaction.content_type == content_type,
            models.ChapterReaction.target_id == target_id,
        )
        .first()
    )

    if existing and existing.reaction == body.reaction:
        db.delete(existing)
        db.commit()
    elif existing:
        existing.reaction = body.reaction
        db.commit()
    else:
        db.add(
            models.ChapterReaction(
                user_id=user.id,
                content_type=content_type,
                target_id=target_id,
                reaction=body.reaction,
            )
        )
        db.commit()

    return _payload(db, content_type, target_id, user)
