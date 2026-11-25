from datetime import datetime, timedelta, timezone
import hashlib
import logging
import threading
import time
from typing import Optional

from fastapi import BackgroundTasks, Request
from sqlalchemy import func, text, update
from sqlalchemy.exc import SQLAlchemyError

import database
import models

logger = logging.getLogger(__name__)

_PG_UPSERT_SQL = text(
    """
    INSERT INTO view_dedupe (dedupe_key, expires_at)
    VALUES (:k, :exp)
    ON CONFLICT (dedupe_key) DO UPDATE
    SET expires_at = EXCLUDED.expires_at
    WHERE view_dedupe.expires_at < NOW()
    RETURNING dedupe_key
    """
)
_PG_PRUNE_SQL = text("DELETE FROM view_dedupe WHERE expires_at < NOW()")

BOT_USER_AGENT_TOKENS = (
    "googlebot",
    "bingbot",
    "yandex",
    "duckduckbot",
    "baiduspider",
    "applebot",
    "ahrefsbot",
    "semrushbot",
    "petalbot",
    "bytespider",
    "gptbot",
    "claudebot",
    "facebookexternalhit",
    "twitterbot",
    "discordbot",
    "telegrambot",
    "whatsapp",
    "slurp",
)


def get_client_ip(request: Request) -> str:
    """Resolve client IP from Cloudflare/proxy headers with direct socket fallback."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    return request.client.host if request.client else "unknown"


def is_bot_request(request: Request) -> bool:
    """Return True if the User-Agent belongs to a known search/social/AI crawler."""
    ua = (request.headers.get("user-agent") or "").lower()
    if not ua:
        return False
    return any(token in ua for token in BOT_USER_AGENT_TOKENS)


def should_skip_view_tracking(request: Request) -> bool:
    """Skip DB view writes on internal Next.js SSR fetches, explicit opt-outs, or bots."""
    if request.headers.get("x-internal-ssr") == "1":
        return True
    track_param = (request.query_params.get("track_view") or "").strip().lower()
    if track_param in ("0", "false", "no"):
        return True
    return is_bot_request(request)


def _increment_view_in_db(
    content_type: str,
    target_id: int,
    webtoon_id: Optional[int] = None,
) -> None:
    """Execute atomic view_count increment(s) in an isolated short-lived DB session."""
    db = database.SessionLocal()
    try:
        if content_type == "novel":
            db.execute(
                update(models.Novel)
                .where(models.Novel.id == target_id)
                .values(view_count=func.coalesce(models.Novel.view_count, 0) + 1)
            )
        elif content_type == "novel_chapter":
            db.execute(
                update(models.NovelChapter)
                .where(models.NovelChapter.id == target_id)
                .values(view_count=func.coalesce(models.NovelChapter.view_count, 0) + 1)
            )
        elif content_type == "webtoon":
            db.execute(
                update(models.Webtoon)
                .where(models.Webtoon.id == target_id)
                .values(view_count=func.coalesce(models.Webtoon.view_count, 0) + 1)
            )
        elif content_type == "episode":
            db.execute(
                update(models.WebtoonEpisode)
                .where(models.WebtoonEpisode.id == target_id)
                .values(view_count=func.coalesce(models.WebtoonEpisode.view_count, 0) + 1)
            )
            if webtoon_id is not None:
                db.execute(
                    update(models.Webtoon)
                    .where(models.Webtoon.id == webtoon_id)
                    .values(view_count=func.coalesce(models.Webtoon.view_count, 0) + 1)
                )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Background view increment failed (%s:%s)", content_type, target_id)
    finally:
        db.close()


def schedule_view_increment(
    background_tasks: BackgroundTasks,
    request: Request,
    content_type: str,
    target_id: int,
    *,
    webtoon_id: Optional[int] = None,
) -> bool:
    """Schedule an atomic DB view increment after response if request is an unthrottled human view."""
    if should_skip_view_tracking(request):
        return False
    client_ip = get_client_ip(request)
    if not view_tracker.should_count_view(client_ip, content_type, target_id):
        return False
    background_tasks.add_task(_increment_view_in_db, content_type, target_id, webtoon_id)
    return True


class ViewTracker:
    """
    IP tabanlı view count rate limiting sistemi.
    PostgreSQL üzerinde UNLOGGED view_dedupe tablosuyla çoklu worker arası atomik
    deduplication yapar; SQLite testlerinde veya tablo henüz migrate edilmemişken
    bellek içi sözlüğe sorunsuz geri döner.
    """

    def __init__(self, ttl_seconds: int = 3600, cleanup_interval_seconds: int = 60):
        self.ttl = ttl_seconds
        self.cleanup_interval = cleanup_interval_seconds
        self.views = {}  # {(ip, content_type, content_id): timestamp}
        self.last_cleanup = datetime.now()
        self.lock = threading.Lock()
        self._last_pg_cleanup_mono = 0.0
        self._pg_fallback_until_mono = 0.0

    @staticmethod
    def _build_dedupe_key(ip: str, content_type: str, content_id: int) -> str:
        raw = f"{content_type}:{content_id}:{ip}"
        if len(raw) <= 160:
            return raw
        ip_hash = hashlib.sha256((ip or "").encode("utf-8")).hexdigest()[:48]
        return f"{content_type}:{content_id}:{ip_hash}"[:160]

    def _is_postgres_active(self) -> bool:
        engine = getattr(database, "engine", None)
        dialect_name = getattr(getattr(engine, "dialect", None), "name", None)
        return dialect_name == "postgresql"

    def _should_count_postgres(self, ip: str, content_type: str, content_id: int) -> bool:
        dedupe_key = self._build_dedupe_key(ip, content_type, content_id)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.ttl)
        now_mono = time.monotonic()

        should_prune = False
        with self.lock:
            if (now_mono - self._last_pg_cleanup_mono) >= self.cleanup_interval:
                self._last_pg_cleanup_mono = now_mono
                should_prune = True

        with database.engine.begin() as conn:
            row = conn.execute(_PG_UPSERT_SQL, {"k": dedupe_key, "exp": expires_at}).first()
            if should_prune:
                conn.execute(_PG_PRUNE_SQL)
        return row is not None

    def _should_count_memory(self, ip: str, content_type: str, content_id: int) -> bool:
        key = (ip, content_type, content_id)
        now = datetime.now()

        with self.lock:
            if (now - self.last_cleanup).total_seconds() >= self.cleanup_interval:
                self._cleanup_old_entries(now)
                self.last_cleanup = now

            if key in self.views:
                last_view = self.views[key]
                elapsed = (now - last_view).total_seconds()
                if elapsed < self.ttl:
                    return False
                self.views[key] = now
                return True

            self.views[key] = now
            return True

    def should_count_view(self, ip: str, content_type: str, content_id: int) -> bool:
        if self._is_postgres_active() and time.monotonic() >= self._pg_fallback_until_mono:
            try:
                return self._should_count_postgres(ip, content_type, content_id)
            except SQLAlchemyError as exc:
                self._pg_fallback_until_mono = time.monotonic() + 60.0
                logger.warning("view_dedupe PostgreSQL fallback to memory: %s", exc)

        return self._should_count_memory(ip, content_type, content_id)

    def _cleanup_old_entries(self, now: datetime):
        expired_keys = [
            k for k, v in self.views.items()
            if (now - v).total_seconds() > self.ttl
        ]
        for k in expired_keys:
            del self.views[k]

    def get_stats(self) -> dict:
        with self.lock:
            total = len(self.views)
            breakdown = {}
            for (_ip, content_type, _content_id) in self.views.keys():
                breakdown[content_type] = breakdown.get(content_type, 0) + 1
            return {
                "total_entries": total,
                "content_types": breakdown,
                "ttl_seconds": self.ttl,
                "backend": "postgresql" if self._is_postgres_active() else "memory",
            }


# ==========================================
# 🌐 GLOBAL INSTANCE
# ==========================================
view_tracker = ViewTracker(ttl_seconds=3600, cleanup_interval_seconds=60)
