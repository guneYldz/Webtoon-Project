from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications (Bildirimler)"]
)


def _announcement_out(item: models.Announcement):
    created = item.created_at.isoformat(sep=" ") if item.created_at else None
    return {
        "id": item.id,
        "title": item.title,
        "message": item.message or "",
        "link": item.link,
        "image": item.image,
        "created_at": created,
        "author": item.author or "admin",
    }


@router.get("/announcements")
def list_announcements(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    items = (
        db.query(models.Announcement)
        .order_by(models.Announcement.id.desc())
        .limit(limit)
        .all()
    )
    return [_announcement_out(item) for item in items]


@router.get("/")
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": row.id,
            "type": row.type or "announcement",
            "title": row.title,
            "message": row.message or "",
            "link": row.link,
            "image": row.image,
            "is_read": bool(row.is_read),
            "created_at": row.created_at.isoformat(sep=" ") if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,
        )
        .count()
    )
    return {"count": count}


@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"status": "success"}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if row:
        row.is_read = True
        db.commit()
    return {"status": "success"}
