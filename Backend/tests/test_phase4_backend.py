import ast
import importlib.util
import os
import shutil
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_CONNECTION", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-phase4-unit-tests")

# Host Python may lack container-only packages; stub only when absent
if "dotenv" not in sys.modules:
    try:
        import dotenv  # noqa: F401
    except ImportError:
        stub_dotenv = types.ModuleType("dotenv")
        stub_dotenv.load_dotenv = lambda *a, **kw: False
        sys.modules["dotenv"] = stub_dotenv

if "nh3" not in sys.modules:
    try:
        import nh3  # noqa: F401
    except ImportError:
        stub_nh3 = types.ModuleType("nh3")
        stub_nh3.clean = lambda html_str, **kwargs: html_str
        sys.modules["nh3"] = stub_nh3

if "email_validator" not in sys.modules:
    try:
        import email_validator  # noqa: F401
    except ImportError:
        import importlib.metadata as _ilm

        stub_ev = types.ModuleType("email_validator")
        stub_ev.__version__ = "2.2.0"

        class _ValidatedEmail:
            def __init__(self, email):
                self.normalized = email
                self.email = email
                self.local_part = email.split("@")[0] if "@" in email else email
                self.domain = email.split("@")[1] if "@" in email else ""

        stub_ev.EmailNotValidError = ValueError
        stub_ev.validate_email = lambda email, **kwargs: _ValidatedEmail(email)
        sys.modules["email_validator"] = stub_ev

        _orig_version = _ilm.version
        _ilm.version = lambda name: "2.2.0" if name == "email-validator" else _orig_version(name)

if "passlib" not in sys.modules:
    try:
        import passlib  # noqa: F401
    except ImportError:
        stub_passlib = types.ModuleType("passlib")
        stub_passlib_ctx = types.ModuleType("passlib.context")

        class _CryptContext:
            def __init__(self, *args, **kwargs):
                pass

            def hash(self, s):
                return f"stub:{s}"

            def verify(self, s, h):
                return h == f"stub:{s}"

        stub_passlib_ctx.CryptContext = _CryptContext
        stub_passlib.context = stub_passlib_ctx
        sys.modules["passlib"] = stub_passlib
        sys.modules["passlib.context"] = stub_passlib_ctx

if "jose" not in sys.modules:
    try:
        import jose  # noqa: F401
    except ImportError:
        stub_jose = types.ModuleType("jose")
        stub_jose.JWTError = Exception
        stub_jose.jwt = types.SimpleNamespace(encode=lambda *a, **k: "tok", decode=lambda *a, **k: {})
        sys.modules["jose"] = stub_jose

if "sqladmin" not in sys.modules:
    try:
        import sqladmin  # noqa: F401
    except ImportError:
        stub_sqladmin = types.ModuleType("sqladmin")
        stub_sqladmin_auth = types.ModuleType("sqladmin.authentication")

        class _ModelView:
            def __init_subclass__(cls, **kwargs):
                pass

            async def on_model_change(self, data, model, is_created, request):
                return None

            async def after_model_change(self, data, model, is_created, request):
                return None

            async def after_model_delete(self, model, request):
                return None

        class _Admin:
            def __init__(self, *args, **kwargs):
                pass

            def add_view(self, *args, **kwargs):
                pass

        class _AuthenticationBackend:
            def __init__(self, *args, **kwargs):
                pass

        stub_sqladmin.Admin = _Admin
        stub_sqladmin.ModelView = _ModelView
        stub_sqladmin_auth.AuthenticationBackend = _AuthenticationBackend
        sys.modules["sqladmin"] = stub_sqladmin
        sys.modules["sqladmin.authentication"] = stub_sqladmin_auth

if "wtforms" not in sys.modules:
    try:
        import wtforms  # noqa: F401
    except ImportError:
        stub_wtf = types.ModuleType("wtforms")
        stub_wtf_widgets = types.ModuleType("wtforms.widgets")
        stub_wtf.TextAreaField = object
        stub_wtf.FileField = object
        stub_wtf.Field = object
        stub_wtf_widgets.FileInput = object
        sys.modules["wtforms"] = stub_wtf
        sys.modules["wtforms.widgets"] = stub_wtf_widgets

if "itsdangerous" not in sys.modules:
    try:
        import itsdangerous  # noqa: F401
    except ImportError:
        stub_its = types.ModuleType("itsdangerous")
        stub_its.__path__ = []
        stub_its_exc = types.ModuleType("itsdangerous.exc")

        class _BadSignature(Exception):
            pass

        class _TimestampSigner:
            def __init__(self, *a, **kw):
                pass

            def sign(self, v):
                return v if isinstance(v, bytes) else str(v).encode("utf-8")

            def unsign(self, v, max_age=None):
                return v if isinstance(v, bytes) else str(v).encode("utf-8")

        stub_its_exc.BadSignature = _BadSignature
        stub_its.exc = stub_its_exc
        stub_its.BadSignature = _BadSignature
        stub_its.TimestampSigner = _TimestampSigner
        sys.modules["itsdangerous"] = stub_its
        sys.modules["itsdangerous.exc"] = stub_its_exc

if "markupsafe" not in sys.modules:
    try:
        import markupsafe  # noqa: F401
    except ImportError:
        stub_ms = types.ModuleType("markupsafe")
        stub_ms.Markup = str
        sys.modules["markupsafe"] = stub_ms

try:
    import python_multipart  # noqa: F401
except ImportError:
    try:
        import multipart  # noqa: F401
    except ImportError:
        import fastapi.dependencies.utils as _fdu

        _fdu.ensure_multipart_is_installed = lambda: None

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
import main as app_main
import models
from routers import chat as chat_router
from routers.auth import get_current_user, get_optional_user
from utils import cache
import utils.media as media_utils


class TestPhase4Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        models.Base.metadata.create_all(bind=cls.engine)

        def _override_get_db():
            db = cls.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app_main.app.dependency_overrides[database.get_db] = _override_get_db
        cls.client = TestClient(app_main.app)

    @classmethod
    def tearDownClass(cls):
        app_main.app.dependency_overrides.clear()
        cls.engine.dispose()

    def setUp(self):
        cache.invalidate_content_caches()
        chat_router.active_sockets.clear()
        with self.engine.begin() as conn:
            for tbl in reversed(models.Base.metadata.sorted_tables):
                conn.execute(tbl.delete())

        db = self.SessionTesting()
        admin = models.User(id=1, username="admin", email="admin@test.local", password="x", role="admin", is_active=True)
        editor = models.User(id=2, username="editor", email="editor@test.local", password="x", role="editor", is_active=True)
        u1 = models.User(id=3, username="reader1", email="u1@test.local", password="x", role="user", is_active=True, profile_image="/static/avatars/u1.webp")
        u2 = models.User(id=4, username="reader2", email="u2@test.local", password="x", role="user", is_active=True)
        db.add_all([admin, editor, u1, u2])

        w1 = models.Webtoon(id=1, title="Solo Leveling", slug="solo-leveling", summary="Hunter", status="ongoing", is_published=True, view_count=100)
        w2 = models.Webtoon(id=2, title="Tower Climb", slug="tower-climb", summary="Tower", status="ongoing", is_published=True, view_count=200)
        ep1 = models.WebtoonEpisode(id=1, webtoon_id=1, episode_number=1, title="Bölüm 1", is_published=True)

        n1 = models.Novel(
            id=1,
            title="Shadow Slave",
            slug="shadow-slave",
            summary="Spell",
            author="G3",
            status="ongoing",
            is_published=True,
            view_count=500,
            translation_glossary="Sunny -> Sunny\nNightmare Spell -> Kabus Büyüsü",
        )
        n2 = models.Novel(
            id=2,
            title="Lord of the Mysteries",
            slug="lord-of-the-mysteries",
            summary="Beyonder",
            author="Cuttlefish",
            status="completed",
            is_published=True,
            view_count=900,
        )
        nc1 = models.NovelChapter(id=1, novel_id=1, chapter_number=1, title="Bölüm 1", content="<p>" + ("Uzun metin " * 140) + "</p>", is_published=True)
        nc2 = models.NovelChapter(id=2, novel_id=1, chapter_number=2, title="Bölüm 2", content="<p>" + ("Diğer bölüm " * 140) + "</p>", is_published=True)

        db.add_all([w1, w2, ep1, n1, n2, nc1, nc2])
        db.commit()
        db.close()

        self.admin_user = types.SimpleNamespace(id=1, username="admin", email="admin@test.local", role="admin", is_active=True, profile_image=None)
        self.editor_user = types.SimpleNamespace(id=2, username="editor", email="editor@test.local", role="editor", is_active=True, profile_image=None)
        self.user1 = types.SimpleNamespace(id=3, username="reader1", email="u1@test.local", role="user", is_active=True, profile_image="/static/avatars/u1.webp")
        self.user2 = types.SimpleNamespace(id=4, username="reader2", email="u2@test.local", role="user", is_active=True, profile_image=None)
        self._as_guest()

    def tearDown(self):
        app_main.app.dependency_overrides.pop(get_current_user, None)
        app_main.app.dependency_overrides.pop(get_optional_user, None)

    def _as_guest(self):
        app_main.app.dependency_overrides.pop(get_current_user, None)
        app_main.app.dependency_overrides[get_optional_user] = lambda: None

    def _as_user(self, user_ns):
        app_main.app.dependency_overrides[get_current_user] = lambda: user_ns
        app_main.app.dependency_overrides[get_optional_user] = lambda: user_ns

    def test_ratings_crud_recalculation_cache_and_sort(self):
        g0 = self.client.get("/ratings/webtoon/1")
        self.assertEqual(g0.status_code, 200)
        self.assertEqual(g0.json(), {"rating_avg": 0.0, "rating_count": 0, "user_rating": None})

        # Unauthenticated POST rejected
        self.assertEqual(self.client.post("/ratings/webtoon/1", json={"score": 5}).status_code, 401)

        # Validation on score & content_type
        self._as_user(self.user1)
        self.assertEqual(self.client.post("/ratings/webtoon/1", json={"score": 0}).status_code, 400)
        self.assertEqual(self.client.post("/ratings/webtoon/1", json={"score": 6}).status_code, 400)
        self.assertEqual(self.client.get("/ratings/anime/1").status_code, 400)
        self.assertEqual(self.client.get("/ratings/webtoon/999").status_code, 404)

        # Populate vitrin cache first to verify cache invalidation
        cache.vitrin_cache.set("dummy", [1, 2, 3])
        self.assertIsNotNone(cache.vitrin_cache.get("dummy"))

        # User1 votes 4 -> avg 4.0, count 1
        r1 = self.client.post("/ratings/webtoon/1", json={"score": 4})
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json(), {"rating_avg": 4.0, "rating_count": 1, "user_rating": 4})
        self.assertIsNone(cache.vitrin_cache.get("dummy"))

        # User2 votes 5 -> avg 4.5, count 2
        self._as_user(self.user2)
        r2 = self.client.post("/ratings/webtoon/1", json={"score": 5})
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json(), {"rating_avg": 4.5, "rating_count": 2, "user_rating": 5})

        # User1 updates vote 4 -> 2 -> avg 3.5, count 2 (no duplicate row)
        self._as_user(self.user1)
        r3 = self.client.post("/ratings/webtoon/1", json={"score": 2})
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(r3.json(), {"rating_avg": 3.5, "rating_count": 2, "user_rating": 2})

        # Webtoon 2 rated 5.0 by user2
        self._as_user(self.user2)
        self.client.post("/ratings/webtoon/2", json={"score": 5})

        # Sort by rating places w2 (5.0) before w1 (3.5) and exposes schema fields
        sorted_w = self.client.get("/webtoons/?sort=rating").json()
        self.assertEqual([w["slug"] for w in sorted_w], ["tower-climb", "solo-leveling"])
        self.assertEqual(sorted_w[0]["rating_avg"], 5.0)
        self.assertEqual(sorted_w[0]["rating_count"], 1)
        self.assertEqual(self.client.get("/webtoons/solo-leveling").json()["rating_avg"], 3.5)

        # User1 deletes vote on webtoon 1 -> avg returns to 5.0, count 1
        self._as_user(self.user1)
        d1 = self.client.delete("/ratings/webtoon/1")
        self.assertEqual(d1.status_code, 200)
        self.assertEqual(d1.json(), {"rating_avg": 5.0, "rating_count": 1, "user_rating": None})

        # Novel rating + sort + detail/card schema fields
        self.client.post("/ratings/novel/2", json={"score": 5})
        self.client.post("/ratings/novel/1", json={"score": 3})
        sorted_n = self.client.get("/novels/?sort=rating").json()
        self.assertEqual([n["slug"] for n in sorted_n], ["lord-of-the-mysteries", "shadow-slave"])
        self.assertEqual(sorted_n[0]["rating_avg"], 5.0)
        self.assertEqual(sorted_n[0]["rating_count"], 1)
        self.assertEqual(self.client.get("/novels/shadow-slave").json()["rating_avg"], 3.0)

    def test_chat_messages_cooldown_soft_delete_and_websocket(self):
        # Initial list empty
        g0 = self.client.get("/chat/messages")
        self.assertEqual(g0.status_code, 200)
        self.assertEqual(g0.json(), {"messages": [], "online_count": 0})

        # Unauthenticated POST rejected
        self.assertEqual(self.client.post("/chat/messages", json={"content": "Selam"}).status_code, 401)

        # Validation errors
        self._as_user(self.user1)
        self.assertEqual(self.client.post("/chat/messages", json={"content": "   "}).status_code, 400)
        self.assertEqual(self.client.post("/chat/messages", json={"content": "x" * 301}).status_code, 400)

        # Valid post
        p1 = self.client.post("/chat/messages", json={"content": "Merhaba Kaos!"})
        self.assertEqual(p1.status_code, 200)
        msg1 = p1.json()
        self.assertEqual(msg1["content"], "Merhaba Kaos!")
        self.assertEqual(msg1["username"], "reader1")
        self.assertEqual(msg1["profile_image"], "/static/avatars/u1.webp")

        # 3-second cooldown triggers 429 for same user
        p_fast = self.client.post("/chat/messages", json={"content": "Spam denemesi"})
        self.assertEqual(p_fast.status_code, 429)

        # Different user can post right away
        self._as_user(self.user2)
        p2 = self.client.post("/chat/messages", json={"content": "Selam reader1!"})
        self.assertEqual(p2.status_code, 200)
        msg2 = p2.json()

        # Incremental fetch with after_id
        inc = self.client.get(f"/chat/messages?after_id={msg1['id']}").json()
        self.assertEqual([m["id"] for m in inc["messages"]], [msg2["id"]])

        # Non-author normal user cannot delete another user's message
        self._as_user(self.user1)
        self.assertEqual(self.client.delete(f"/chat/messages/{msg2['id']}").status_code, 403)

        # Author deletes own message -> soft deleted + hidden from GET
        del_own = self.client.delete(f"/chat/messages/{msg1['id']}")
        self.assertEqual(del_own.status_code, 200)
        self.assertEqual(del_own.json(), {"ok": True, "id": msg1["id"]})

        # Admin can delete user2's message
        self._as_user(self.admin_user)
        del_mod = self.client.delete(f"/chat/messages/{msg2['id']}")
        self.assertEqual(del_mod.status_code, 200)

        after_del = self.client.get("/chat/messages").json()
        self.assertEqual(after_del["messages"], [])

        # Multi-worker poll helper detects newly added + newly deleted rows cleanly
        cursor_id, delete_cursor = chat_router._get_initial_cursors_sync(app_main.app)
        delete_cursor = delete_cursor - timedelta(seconds=5)
        db = self.SessionTesting()
        new_row = models.ChatMessage(user_id=3, content="Worker 2 mesaji", is_deleted=False, created_at=datetime.utcnow())
        db.add(new_row)
        db.commit()
        db.refresh(new_row)
        new_msgs, del_ids, next_id, _, _ = chat_router._poll_changes_sync(
            cursor_id, delete_cursor, set(), app_main.app
        )
        db.close()
        self.assertEqual([m["id"] for m in new_msgs], [new_row.id])
        self.assertEqual(sorted(del_ids), sorted([msg1["id"], msg2["id"]]))
        self.assertEqual(next_id, new_row.id)

        # WebSocket connects, sends presence + answers ping/pong + cleans up sockets
        with self.client.websocket_connect("/chat/ws") as ws:
            presence = ws.receive_json()
            self.assertEqual(presence["type"], "presence")
            self.assertGreaterEqual(presence["online_count"], 1)
            ws.send_text("ping")
            self.assertEqual(ws.receive_text(), "pong")
        self.assertEqual(len(chat_router.active_sockets), 0)

    def test_novel_latest_chapter_glossary_and_admin_endpoints(self):
        # Lightweight bot endpoint returns max chapter & DB glossary without loading prose
        latest = self.client.get("/novels/shadow-slave/latest-chapter")
        self.assertEqual(latest.status_code, 200)
        self.assertEqual(
            latest.json(),
            {
                "novel_id": 1,
                "slug": "shadow-slave",
                "title": "Shadow Slave",
                "latest_chapter_number": 2,
                "chapter_count": 2,
                "translation_glossary": "Sunny -> Sunny\nNightmare Spell -> Kabus Büyüsü",
            },
        )
        self.assertNotIn("Uzun metin", latest.text)

        # Non-admin denied on admin/editor endpoints
        self._as_user(self.user1)
        self.assertEqual(self.client.get("/admin/novels/1").status_code, 403)
        self.assertEqual(self.client.get("/admin/webtoon/1/episodes").status_code, 403)

        # Editor can fetch /admin/webtoon/{id}/episodes
        self._as_user(self.editor_user)
        eps = self.client.get("/admin/webtoon/1/episodes")
        self.assertEqual(eps.status_code, 200)
        self.assertEqual([e["episode_number"] for e in eps.json()], [1.0])

        # Admin reads and updates translation_glossary via JSON & Form (without wiping when omitted)
        self._as_user(self.admin_user)
        g_novel = self.client.get("/admin/novels/1").json()["data"]
        self.assertEqual(g_novel["translation_glossary"], "Sunny -> Sunny\nNightmare Spell -> Kabus Büyüsü")

        up_json = self.client.put(
            "/admin/novels/2",
            json={"translation_glossary": "Klein Moretti -> Klein Moretti"},
        )
        self.assertEqual(up_json.status_code, 200)
        self.assertEqual(up_json.json()["data"]["translation_glossary"], "Klein Moretti -> Klein Moretti")

        # Omitting translation_glossary in subsequent update preserves existing value
        up_keep = self.client.put("/admin/novels/2", json={"status": "ongoing"})
        self.assertEqual(up_keep.status_code, 200)
        self.assertEqual(up_keep.json()["data"]["translation_glossary"], "Klein Moretti -> Klein Moretti")

        # Webtoon translation_glossary via Form/urlencoded update + GET
        up_w = self.client.put(
            "/admin/webtoons/1",
            data={"translation_glossary": "Sung Jin-Woo -> Sung Jin-Woo"},
        )
        self.assertEqual(up_w.status_code, 200)
        self.assertEqual(up_w.json()["data"]["translation_glossary"], "Sung Jin-Woo -> Sung Jin-Woo")
        self.assertEqual(
            self.client.get("/admin/webtoons/1").json()["data"]["translation_glossary"],
            "Sung Jin-Woo -> Sung Jin-Woo",
        )

    def test_admin_health_scan_broken_images_chapters_and_covers(self):
        # Normal user denied; editor allowed
        self._as_user(self.user1)
        self.assertEqual(self.client.get("/admin/health-scan").status_code, 403)

        temp_static = tempfile.mkdtemp(prefix="kaos_health_test_")
        orig_static = media_utils.STATIC_ROOT
        try:
            media_utils.STATIC_ROOT = temp_static
            Path(temp_static, "covers").mkdir(parents=True, exist_ok=True)
            Path(temp_static, "images").mkdir(parents=True, exist_ok=True)

            # Valid files
            Path(temp_static, "covers", "valid.webp").write_bytes(b"RIFF1234WEBP")
            Path(temp_static, "images", "ok.webp").write_bytes(b"RIFF1234WEBP")
            # 0-byte broken files
            Path(temp_static, "images", "empty.webp").write_bytes(b"")
            Path(temp_static, "covers", "empty-cover.webp").write_bytes(b"")

            db = self.SessionTesting()
            w1 = db.query(models.Webtoon).get(1)
            w1.cover_image = "/static/covers/valid.webp"
            w2 = db.query(models.Webtoon).get(2)
            w2.cover_image = "static/covers/empty-cover.webp"

            n1 = db.query(models.Novel).get(1)
            n1.cover_image = "/static/covers/missing-novel.webp"
            n2 = db.query(models.Novel).get(2)
            n2.cover_image = "https://cdn.example.com/external-cover.webp"

            db.add_all([
                models.EpisodeImage(episode_id=1, image_url="/static/images/ok.webp", page_order=1),
                models.EpisodeImage(episode_id=1, image_url="/static/images/missing.webp", page_order=2),
                models.EpisodeImage(episode_id=1, image_url="images/empty.webp", page_order=3),
                models.NovelChapter(novel_id=2, chapter_number=1, title="Kısa", content="<p>Çok kısa metin.</p>", is_published=True),
                models.NovelChapter(novel_id=2, chapter_number=2, title="Telif", content="<p>I'm sorry, I cannot translate copyrighted content.</p>", is_published=True),
                models.NovelChapter(novel_id=2, chapter_number=3, title="Taslak", content="<p>Taslak kısa</p>", is_published=False),
            ])
            db.commit()
            db.close()

            self._as_user(self.editor_user)
            res = self.client.get("/admin/health-scan")
            self.assertEqual(res.status_code, 200)
            payload = res.json()

            self.assertEqual(payload["summary"]["broken_images"], 2)
            self.assertEqual(payload["summary"]["short_chapters"], 1)
            self.assertEqual(payload["summary"]["refusal_chapters"], 1)
            self.assertEqual(payload["summary"]["missing_covers"], 2)
            self.assertTrue(payload["summary"]["scanned_at"])

            img_reasons = {item["image_url"]: item["reason"] for item in payload["broken_images"]}
            self.assertEqual(img_reasons["/static/images/missing.webp"], "missing_file")
            self.assertEqual(img_reasons["images/empty.webp"], "empty_file")

            chap_issues = {item["title"]: item["issue"] for item in payload["suspicious_chapters"]}
            self.assertEqual(chap_issues, {"Kısa": "short", "Telif": "refusal"})
            self.assertEqual(len(payload["missing_covers"]), 2)
        finally:
            media_utils.STATIC_ROOT = orig_static
            shutil.rmtree(temp_static, ignore_errors=True)

    def test_bots_api_mode_and_glossary_support(self):
        # 1. Verify botoon.py runs cleanly in API-only mode (no DB env var required!)
        botoon_path = BACKEND_DIR / "bot" / "botoon.py"
        botoon_src = botoon_path.read_text(encoding="utf-8")
        self.assertNotIn("if not _raw_db:\n    raise RuntimeError", botoon_src)
        self.assertIn('(body.get("data") or {}).get("id")', botoon_src)

        stub_uc = types.ModuleType("undetected_chromedriver")
        stub_sel = types.ModuleType("selenium")
        stub_sel_wd = types.ModuleType("selenium.webdriver")
        stub_sel_by = types.ModuleType("selenium.webdriver.common.by")
        stub_sel_ui = types.ModuleType("selenium.webdriver.support.ui")
        stub_sel_ec = types.ModuleType("selenium.webdriver.support.expected_conditions")
        stub_sel_by.By = object
        stub_sel_ui.WebDriverWait = object

        stub_dotenv_local = types.ModuleType("dotenv")
        stub_dotenv_local.load_dotenv = lambda *a, **kw: False

        env_patch = {
            "BOT_API_URL": "http://127.0.0.1:8000",
            "BOT_USERNAME": "bot_admin",
            "BOT_PASSWORD": "bot_password",
        }
        with mock.patch.dict(os.environ, env_patch, clear=False):
            os.environ.pop("BOT_DB_CONNECTION", None)
            os.environ.pop("DB_CONNECTION", None)
            try:
                with mock.patch.dict(
                    sys.modules,
                    {
                        "dotenv": stub_dotenv_local,
                        "undetected_chromedriver": stub_uc,
                        "selenium": stub_sel,
                        "selenium.webdriver": stub_sel_wd,
                        "selenium.webdriver.common": types.ModuleType("selenium.webdriver.common"),
                        "selenium.webdriver.common.by": stub_sel_by,
                        "selenium.webdriver.support": types.ModuleType("selenium.webdriver.support"),
                        "selenium.webdriver.support.ui": stub_sel_ui,
                        "selenium.webdriver.support.expected_conditions": stub_sel_ec,
                    },
                ):
                    spec = importlib.util.spec_from_file_location("test_botoon_api_mode", botoon_path)
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    self.assertIsNone(mod.engine)
                    self.assertTrue(mod._has_api_config())

                    # Verify api_get_or_create_webtoon parses nested data.id from /admin/webtoon/create
                    def _fake_get(url, **kw):
                        status = 404 if "/webtoons/" in url else 200
                        return types.SimpleNamespace(status_code=status, json=lambda: [])

                    def _fake_post(url, **kw):
                        if "/auth/giris-yap" in url:
                            return types.SimpleNamespace(
                                status_code=200,
                                raise_for_status=lambda: None,
                                json=lambda: {"access_token": "tok"},
                                text="ok",
                            )
                        return types.SimpleNamespace(
                            status_code=200,
                            json=lambda: {"status": "success", "data": {"id": 42}},
                            text="ok",
                        )

                    with mock.patch.object(mod.requests, "get", side_effect=_fake_get), mock.patch.object(
                        mod.requests, "post", side_effect=_fake_post
                    ):
                        self.assertEqual(mod.api_get_or_create_webtoon("New Series", "new-series"), 42)

                    # All 3 downloaders delegate persistence to _persist_episode (API-capable)
                    tree = ast.parse(botoon_src)
                    method_calls = {}
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef) and node.name in (
                            "download_chapter_manga_tr",
                            "download_chapter_asurascans",
                            "download_chapter",
                        ):
                            calls = [
                                n.func.id
                                for n in ast.walk(node)
                                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                            ]
                            method_calls[node.name] = calls
                    for fn_name in ("download_chapter_manga_tr", "download_chapter_asurascans", "download_chapter"):
                        self.assertIn("_persist_episode", method_calls.get(fn_name, []))
            finally:
                os.environ["DB_CONNECTION"] = "sqlite:///:memory:"

        # 2. Verify kaosnovelbot.py uses BOT_API_URL + latest-chapter + DB translation_glossary
        novelbot_src = (BACKEND_DIR / "bot" / "kaosnovelbot.py").read_text(encoding="utf-8")
        self.assertIn('os.getenv("BOT_API_URL", "http://127.0.0.1:8000")', novelbot_src)
        self.assertIn("/latest-chapter", novelbot_src)
        self.assertIn('novel.get("translation_glossary")', novelbot_src)

    def test_alembic_005_chain_and_lf_script(self):
        versions_dir = BACKEND_DIR / "alembic" / "versions"
        revs = {}
        for py_file in sorted(versions_dir.glob("*.py")):
            tree = ast.parse(py_file.read_text(encoding="utf-8"))
            rev = None
            down_rev = None
            for node in tree.body:
                val = None
                target_name = None
                if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    target_name = node.targets[0].id
                    val = ast.literal_eval(node.value) if isinstance(node.value, ast.Constant) else None
                elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value is not None:
                    target_name = node.target.id
                    val = ast.literal_eval(node.value) if isinstance(node.value, ast.Constant) else None
                if target_name == "revision":
                    rev = val
                elif target_name == "down_revision":
                    down_rev = val
            revs[rev] = down_rev

        self.assertEqual(revs.get("002_seo_sitemap_indexes"), "001_phase1_schema_and_indexes")
        self.assertEqual(revs.get("003_phase2_view_dedupe"), "002_seo_sitemap_indexes")
        self.assertEqual(revs.get("004_phase3_retention_community"), "003_phase2_view_dedupe")
        self.assertEqual(revs.get("005_phase4_ratings_glossary_chat"), "004_phase3_retention_community")
        heads = set(revs.keys()) - set(revs.values())
        self.assertEqual(heads, {"005_phase4_ratings_glossary_chat"})

        mig_bytes = (BACKEND_DIR / "scripts" / "migrate_phase4.sh").read_bytes()
        self.assertEqual(mig_bytes.count(b"\r"), 0)


if __name__ == "__main__":
    unittest.main()
