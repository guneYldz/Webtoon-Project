import asyncio
from datetime import datetime, timezone
import json
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload
from starlette.concurrency import run_in_threadpool

import models
from database import SessionLocal, get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat (Anasayfa Canlı Sohbet)"])

COOLDOWN_SECONDS = 3
POLL_INTERVAL_SECONDS = 1.5
MAX_MESSAGE_LENGTH = 300

active_sockets: Set[WebSocket] = set()
_watcher_task: Optional[asyncio.Task] = None
_watcher_loop: Optional[asyncio.AbstractEventLoop] = None
_watcher_app = None


class ChatMessageIn(BaseModel):
    content: str


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    naive = _to_naive_utc(dt)
    if naive is None:
        return None
    return naive.replace(tzinfo=timezone.utc).isoformat()


def _serialize_message(msg: models.ChatMessage, user: Optional[models.User] = None) -> Dict:
    author = user if user is not None else getattr(msg, "user", None)
    return {
        "id": int(msg.id),
        "content": msg.content,
        "created_at": _utc_iso(msg.created_at),
        "user_id": int(msg.user_id),
        "username": (author.username if author else None) or "Anonim",
        "role": (author.role if author else None) or "user",
        "profile_image": author.profile_image if author else None,
    }


def _open_poll_session(app=None):
    override = app.dependency_overrides.get(get_db) if app is not None else None
    if override is not None:
        gen = override()
        return next(gen), gen
    return SessionLocal(), None


def _close_poll_session(db: Session, gen) -> None:
    if gen is not None:
        try:
            gen.close()
        except Exception:
            pass
    else:
        db.close()


def _get_initial_cursors_sync(app=None) -> tuple[int, datetime]:
    db, gen = _open_poll_session(app)
    try:
        max_id = db.query(func.max(models.ChatMessage.id)).scalar()
        return int(max_id or 0), datetime.utcnow()
    finally:
        _close_poll_session(db, gen)


def _poll_changes_sync(
    last_seen_id: int,
    last_delete_check: datetime,
    recent_deleted_ids: Set[int],
    app=None,
) -> tuple[List[Dict], List[int], int, datetime, Set[int]]:
    """Kısa ömürlü DB oturumuyla yeni ve yeni silinmiş sohbet mesajlarını tarar."""
    db, gen = _open_poll_session(app)
    try:
        new_rows = (
            db.query(models.ChatMessage)
            .options(joinedload(models.ChatMessage.user))
            .filter(
                models.ChatMessage.is_deleted == False,
                models.ChatMessage.id > last_seen_id,
            )
            .order_by(models.ChatMessage.id.asc())
            .limit(100)
            .all()
        )
        new_payloads = [_serialize_message(row) for row in new_rows]
        next_last_id = int(new_rows[-1].id) if new_rows else last_seen_id

        del_rows = (
            db.query(models.ChatMessage.id, models.ChatMessage.deleted_at)
            .filter(
                models.ChatMessage.is_deleted == True,
                models.ChatMessage.deleted_at.isnot(None),
                models.ChatMessage.deleted_at >= last_delete_check,
            )
            .order_by(models.ChatMessage.deleted_at.asc(), models.ChatMessage.id.asc())
            .limit(100)
            .all()
        )
        deleted_ids: List[int] = []
        next_delete_check = last_delete_check
        next_recent = set(recent_deleted_ids)

        for del_id, del_at in del_rows:
            del_id_int = int(del_id)
            del_at_naive = _to_naive_utc(del_at)
            if del_at_naive and del_at_naive > next_delete_check:
                next_delete_check = del_at_naive
                next_recent = set()
            if del_id_int not in recent_deleted_ids:
                deleted_ids.append(del_id_int)
                next_recent.add(del_id_int)

        return new_payloads, deleted_ids, next_last_id, next_delete_check, next_recent
    finally:
        _close_poll_session(db, gen)


async def _broadcast_json(payload: Dict) -> None:
    if not active_sockets:
        return
    dead: List[WebSocket] = []
    for ws in list(active_sockets):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_sockets.discard(ws)


async def _chat_watcher_loop() -> None:
    """Worker başına tek arka plan izleyici: aktif soket varken 1.5s aralıkla DB'yi dinler."""
    try:
        last_seen_id, last_delete_check = await run_in_threadpool(
            _get_initial_cursors_sync,
            _watcher_app,
        )
        recent_deleted_ids: Set[int] = set()

        while active_sockets:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            if not active_sockets:
                break

            try:
                (
                    new_msgs,
                    deleted_ids,
                    last_seen_id,
                    last_delete_check,
                    recent_deleted_ids,
                ) = await run_in_threadpool(
                    _poll_changes_sync,
                    last_seen_id,
                    last_delete_check,
                    recent_deleted_ids,
                    _watcher_app,
                )
            except Exception:
                continue

            for msg_data in new_msgs:
                await _broadcast_json({"type": "message", "data": msg_data})
            for del_id in deleted_ids:
                await _broadcast_json({"type": "delete", "id": del_id})
    except asyncio.CancelledError:
        return


def _ensure_watcher_started(app=None) -> None:
    global _watcher_task, _watcher_loop, _watcher_app
    loop = asyncio.get_running_loop()
    _watcher_app = app
    if _watcher_task is None or _watcher_task.done() or _watcher_loop is not loop:
        _watcher_loop = loop
        _watcher_task = loop.create_task(_chat_watcher_loop())


def _stop_watcher_if_empty() -> None:
    global _watcher_task, _watcher_loop
    if not active_sockets and _watcher_task is not None:
        if not _watcher_task.done():
            _watcher_task.cancel()
        _watcher_task = None
        _watcher_loop = None


@router.get("/messages")
def list_chat_messages(
    limit: int = Query(default=50, ge=1, le=200),
    after_id: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Silinmemiş sohbet mesajlarını id ASC sırasıyla ve çevrimiçi sayısını döner."""
    base_q = (
        db.query(models.ChatMessage)
        .options(joinedload(models.ChatMessage.user))
        .filter(models.ChatMessage.is_deleted == False)
    )
    if after_id > 0:
        rows = (
            base_q.filter(models.ChatMessage.id > after_id)
            .order_by(models.ChatMessage.id.asc())
            .limit(limit)
            .all()
        )
    else:
        rows = base_q.order_by(desc(models.ChatMessage.id)).limit(limit).all()
        rows.reverse()

    return {
        "messages": [_serialize_message(row) for row in rows],
        "online_count": len(active_sockets),
    }


@router.post("/messages")
def create_chat_message(
    payload: ChatMessageIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Doğrulanmış kullanıcı adına yeni sohbet mesajı oluşturur (3 saniye bekleme süreli)."""
    content = (payload.content or "").replace("\x00", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz.")
    if len(content) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Mesaj en fazla {MAX_MESSAGE_LENGTH} karakter olabilir.",
        )

    now = datetime.utcnow()
    latest = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == user.id)
        .order_by(desc(models.ChatMessage.created_at), desc(models.ChatMessage.id))
        .first()
    )
    if latest and latest.created_at is not None:
        elapsed = (now - _to_naive_utc(latest.created_at)).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=429,
                detail="Çok hızlı mesaj gönderiyorsunuz, lütfen birkaç saniye bekleyin.",
            )

    msg = models.ChatMessage(
        user_id=user.id,
        content=content,
        is_deleted=False,
        created_at=now,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _serialize_message(msg, user=user)


@router.delete("/messages/{message_id}")
def delete_chat_message(
    message_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mesaj sahibinin veya admin/editörün sohbet mesajını yumuşak silmesini sağlar."""
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı.")

    is_moderator = (user.role or "").strip().lower() in ("admin", "editor")
    if msg.user_id != user.id and not is_moderator:
        raise HTTPException(status_code=403, detail="Bu mesajı silme yetkiniz yok.")

    if not msg.is_deleted:
        msg.is_deleted = True
        msg.deleted_at = datetime.utcnow()
        db.commit()

    return {"ok": True, "id": int(msg.id)}


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket):
    """Anlık mesaj, silme ve çevrimiçi sayısı akışı sağlayan çoklu-worker uyumlu WebSocket."""
    await websocket.accept()
    active_sockets.add(websocket)
    _ensure_watcher_started(websocket.app)
    await _broadcast_json({"type": "presence", "online_count": len(active_sockets)})

    try:
        while True:
            raw = await websocket.receive_text()
            cleaned = (raw or "").strip()
            if cleaned.lower() == "ping":
                await websocket.send_text("pong")
                continue
            try:
                frame = json.loads(cleaned)
                if isinstance(frame, dict) and frame.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                pass
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        active_sockets.discard(websocket)
        _stop_watcher_if_empty()
        if active_sockets:
            await _broadcast_json({"type": "presence", "online_count": len(active_sockets)})
