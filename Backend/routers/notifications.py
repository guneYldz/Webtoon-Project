from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, insert, literal, select
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from routers.auth import get_current_user
import models

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications (Bildirimler)"]
)


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: str


def _to_dict(n: models.Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "link": n.link,
        "is_read": bool(n.is_read),
        "created_at": str(n.created_at),
    }


def create_notification(db: Session, user_id: int, type_: str, title: str, message: str, link: str = None):
    """Başka router'lardan da çağrılabilen yardımcı."""
    n = models.Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        link=link,
        is_read=False,
    )
    db.add(n)
    return n


def notify_favorite_users_new_chapter(
    db: Session,
    *,
    novel_id: int = None,
    webtoon_id: int = None,
    series_title: str,
    chapter_label: str,
    link: str,
) -> int:
    """
    Favorisinde bu seri olan aktif kullanıcılara tek toplu SQL INSERT ile yeni bölüm bildirimi gönderir.
    """
    if novel_id is not None:
        target_filter = models.Favorite.novel_id == novel_id
    elif webtoon_id is not None:
        target_filter = models.Favorite.webtoon_id == webtoon_id
    else:
        return 0

    now_utc = datetime.utcnow()
    title = f"{series_title} — yeni bölüm"
    msg = (
        f"Favorilerinizde olan {series_title} serisinin "
        f"{chapter_label} bölümü gelmiştir, keyifli okumalar dileriz."
    )

    select_stmt = (
        select(
            models.Favorite.user_id.label("user_id"),
            literal("favorite_update").label("type"),
            literal(title).label("title"),
            literal(msg).label("message"),
            literal(link).label("link"),
            literal(False).label("is_read"),
            literal(now_utc).label("created_at"),
        )
        .select_from(models.Favorite)
        .join(models.User, models.User.id == models.Favorite.user_id)
        .where(
            models.Favorite.user_id.isnot(None),
            models.User.is_active == True,
            func.coalesce(models.Favorite.notify_new_chapters, True) == True,
            target_filter,
        )
        .distinct()
    )

    stmt = insert(models.Notification).from_select(
        ["user_id", "type", "title", "message", "link", "is_read", "created_at"],
        select_stmt,
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def notify_all_active_users(
    db: Session,
    *,
    type_: str = "announcement",
    title: str,
    message: str,
    link: Optional[str] = None,
) -> int:
    """Tüm aktif kullanıcılara tek toplu SQL INSERT ... SELECT ile bildirim oluşturur."""
    now_utc = datetime.utcnow()
    select_stmt = (
        select(
            models.User.id.label("user_id"),
            literal(type_).label("type"),
            literal(title).label("title"),
            literal(message).label("message"),
            literal(link).label("link"),
            literal(False).label("is_read"),
            literal(now_utc).label("created_at"),
        )
        .where(models.User.is_active == True)
    )
    stmt = insert(models.Notification).from_select(
        ["user_id", "type", "title", "message", "link", "is_read", "created_at"],
        select_stmt,
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def prune_old_read_notifications(db: Session, older_than_days: int = 90) -> int:
    """Belirtilen günden eski ve okunmuş bildirim kayıtlarını toplu siler."""
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)
    deleted = (
        db.query(models.Notification)
        .filter(
            models.Notification.is_read == True,
            models.Notification.created_at < cutoff,
        )
        .delete(synchronize_session=False)
    )
    return int(deleted or 0)


# Herkese açık duyuru listesi (Duyurular sayfası)
@router.get("/announcements")
def list_announcements(limit: int = 50, db: Session = Depends(get_db)):
    items = db.query(models.Announcement)\
        .order_by(desc(models.Announcement.created_at))\
        .limit(min(limit, 100))\
        .all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "link": a.link,
            "image": a.image,
            "created_at": str(a.created_at),
            "author": a.author.username if a.author else "Admin",
        }
        for a in items
    ]


# 1. Bildirim listesi (giriş yapmış kullanıcı)
@router.get("/", response_model=List[NotificationOut])
def list_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    items = db.query(models.Notification)\
        .filter(models.Notification.user_id == current_user.id)\
        .order_by(desc(models.Notification.created_at))\
        .limit(min(limit, 100))\
        .all()
    return [_to_dict(n) for n in items]


# 2. Okunmamış sayısı (badge için)
@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    count = db.query(func.count(models.Notification.id))\
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False
        ).scalar()
    return {"count": count or 0}


# 3. Tümünü okundu işaretle (zile tıklanınca — liste silinmez)
@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.Notification)\
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False
        ).update({"is_read": True})
    db.commit()
    return {"message": "Tüm bildirimler okundu işaretlendi"}


# 4. Tek bildirimi okundu işaretle
@router.post("/{notification_id}/read")
def mark_one_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    n.is_read = True
    db.commit()
    return {"message": "Okundu"}
