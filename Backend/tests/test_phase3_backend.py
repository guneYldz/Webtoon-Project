import ast
import os
import sys
import types
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_CONNECTION", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-phase3-unit-tests")

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
        stub_nh3.clean = lambda html, **kwargs: html
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
from routers import notifications
from routers.auth import get_current_user, get_optional_user
from utils import cache


class TestPhase3Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        cls.SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        models.Base.metadata.create_all(bind=cls.engine)
        cls._orig_session_local = database.SessionLocal
        database.SessionLocal = cls.SessionTesting

        cls.app = app_main.app
        cls._orig_overrides = dict(cls.app.dependency_overrides)

        def override_get_db():
            db = cls.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        cls.app.dependency_overrides[database.get_db] = override_get_db
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.app.dependency_overrides = cls._orig_overrides
        database.SessionLocal = cls._orig_session_local
        cls.engine.dispose()

    def setUp(self):
        cache.invalidate_content_caches()
        self.app.dependency_overrides.pop(get_current_user, None)
        self.app.dependency_overrides.pop(get_optional_user, None)
        db = self.SessionTesting()
        for model in (
            models.CommentReport,
            models.CommentLike,
            models.Comment,
            models.UserReadingProgress,
            models.Notification,
            models.Favorite,
            models.WebtoonCategory,
            models.NovelCategory,
            models.WebtoonEpisode,
            models.NovelChapter,
            models.Webtoon,
            models.Novel,
            models.Category,
            models.User,
        ):
            db.query(model).delete()
        db.commit()

        self.admin_ns = types.SimpleNamespace(id=1, username="adm", email="adm@example.com", role="admin", is_active=True, profile_image=None)
        self.editor_ns = types.SimpleNamespace(id=2, username="edt", email="edt@example.com", role="editor", is_active=True, profile_image=None)
        self.user1_ns = types.SimpleNamespace(id=3, username="reader1", email="r1@example.com", role="user", is_active=True, profile_image="static/profile_images/r1.webp")
        self.user2_ns = types.SimpleNamespace(id=4, username="reader2", email="r2@example.com", role="user", is_active=True, profile_image=None)

        db.add_all([
            models.User(id=1, username="adm", email="adm@example.com", password="x", role="admin", is_active=True),
            models.User(id=2, username="edt", email="edt@example.com", password="x", role="editor", is_active=True),
            models.User(id=3, username="reader1", email="r1@example.com", password="x", role="user", is_active=True, profile_image="static/profile_images/r1.webp"),
            models.User(id=4, username="reader2", email="r2@example.com", password="x", role="user", is_active=True),
        ])

        c_action = models.Category(id=1, name="Aksiyon")
        c_fantasy = models.Category(id=2, name="Fantastik")
        c_slice = models.Category(id=3, name="Günlük Yaşam")

        w1 = models.Webtoon(id=1, title="Solo Leveling", slug="solo-leveling", summary="s", status="ongoing", is_published=True, view_count=500, type=models.ContentType.WEBTOON)
        w2 = models.Webtoon(id=2, title="Tower Climb", slug="tower-climb", summary="s", status="ongoing", is_published=True, view_count=200, type=models.ContentType.WEBTOON)
        w3 = models.Webtoon(id=3, title="Cozy Bake", slug="cozy-bake", summary="s", status="completed", is_published=True, view_count=5, type=models.ContentType.MANGA)
        w_unpub = models.Webtoon(id=4, title="Hidden Webtoon", slug="hidden-w", summary="s", status="ongoing", is_published=False, view_count=9999)

        n1 = models.Novel(id=1, title="Shadow Novel", slug="shadow-novel", summary="s", status="ongoing", is_published=True, view_count=400)
        n2 = models.Novel(id=2, title="Oak Tree", slug="oak-tree", summary="s", status="completed", is_published=True, view_count=150)

        w1.categories = [c_action, c_fantasy]
        w2.categories = [c_action, c_fantasy]
        w3.categories = [c_slice]
        n1.categories = [c_action, c_fantasy]
        n2.categories = [c_slice]

        db.add_all([c_action, c_fantasy, c_slice, w1, w2, w3, w_unpub, n1, n2])
        db.flush()

        db.add_all([
            models.WebtoonEpisode(id=101, webtoon_id=1, title="Giriş", episode_number=1.0, is_published=True),
            models.NovelChapter(id=201, novel_id=1, chapter_number=1.0, title="Bölüm 1", content="<p>Hi</p>", is_published=True),
        ])
        db.commit()
        db.close()

    def _as_user(self, ns):
        if ns is None:
            self.app.dependency_overrides.pop(get_current_user, None)
            self.app.dependency_overrides.pop(get_optional_user, None)
        else:
            self.app.dependency_overrides[get_current_user] = lambda: ns
            self.app.dependency_overrides[get_optional_user] = lambda: ns

    def test_reading_progress_sync_merge_order_and_delete(self):
        self.assertEqual(self.client.get("/reading-progress").status_code, 401)
        self._as_user(self.user1_ns)

        # Initial batch sync with real ms timestamp (> 2^31-1)
        res1 = self.client.post(
            "/reading-progress/sync",
            json={
                "items": [
                    {
                        "type": "webtoon",
                        "seriesType": "WEBTOON",
                        "seriesId": 1,
                        "slug": "solo-leveling",
                        "title": "Solo Leveling",
                        "coverImage": "static/covers/w1.webp",
                        "lastChapterId": 101,
                        "lastChapterNumber": 1,
                        "lastChapterTitle": "Giriş",
                        "lastChapterUrl": "/webtoon/solo-leveling/bolum/101",
                        "scrollPct": 45,
                        "readChapterIds": [101, 102],
                        "updatedAt": 1795600000123,
                    },
                    {
                        "type": "novel",
                        "seriesType": "NOVEL",
                        "seriesId": 1,
                        "slug": "shadow-novel",
                        "title": "Shadow Novel",
                        "coverImage": "static/covers/n1.webp",
                        "lastChapterId": 201,
                        "lastChapterNumber": 5,
                        "lastChapterUrl": "/novel/shadow-novel/bolum/5",
                        "scrollPct": 80,
                        "readChapterIds": [1, 2, 3],
                        "updatedAt": 1795600000500,
                    },
                ]
            },
        )
        self.assertEqual(res1.status_code, 200, res1.text)
        items = res1.json()["items"]
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["seriesId"], 1)
        self.assertEqual(items[0]["type"], "novel")  # higher updatedAt first

        # Sync older timestamp -> keeps newer lastChapterNumber/scrollPct, still unions readChapterIds
        older_res = self.client.post(
            "/reading-progress/sync",
            json={
                "type": "novel",
                "seriesId": 1,
                "lastChapterNumber": 2,
                "lastChapterUrl": "/novel/shadow-novel/bolum/2",
                "scrollPct": 10,
                "readChapterIds": [3, 4],
                "updatedAt": 1795600000100,
            },
        )
        self.assertEqual(older_res.status_code, 200)
        novel_item = next(x for x in older_res.json()["items"] if x["type"] == "novel")
        self.assertEqual(novel_item["lastChapterNumber"], 5)
        self.assertEqual(novel_item["scrollPct"], 80)
        self.assertEqual(novel_item["readChapterIds"], [1, 2, 3, 4])

        # Verify 500-entry readChapterIds cap
        cap_res = self.client.post(
            "/reading-progress/sync",
            json={
                "type": "webtoon",
                "seriesId": 1,
                "lastChapterNumber": 10,
                "readChapterIds": list(range(1, 560)),
                "updatedAt": 1795600001000,
            },
        )
        web_item = next(x for x in cap_res.json()["items"] if x["type"] == "webtoon")
        self.assertEqual(len(web_item["readChapterIds"]), 500)

        # Delete single & clear all
        del_one = self.client.delete("/reading-progress/webtoon/1")
        self.assertEqual(del_one.status_code, 200)
        self.assertEqual(del_one.json(), {"ok": True})
        self.assertEqual(len(self.client.get("/reading-progress").json()["items"]), 1)

        del_all = self.client.delete("/reading-progress")
        self.assertEqual(del_all.status_code, 200)
        self.assertEqual(len(self.client.get("/reading-progress").json()["items"]), 0)

    def test_favorites_status_notify_and_muted_notification_skip(self):
        self._as_user(self.user1_ns)

        # Toggle on with plan_to_read & notify_new_chapters=False
        t1 = self.client.post(
            "/favorites/toggle",
            json={"novel_id": 1, "status": "plan_to_read", "notify_new_chapters": False},
        )
        self.assertEqual(t1.status_code, 200)
        self.assertTrue(t1.json()["is_favorite"])
        self.assertEqual(t1.json()["status"], "plan_to_read")
        self.assertFalse(t1.json()["notify_new_chapters"])

        # Kontrol endpoint (both query and path)
        ctrl = self.client.get("/favorites/kontrol?novel_id=1")
        self.assertEqual(ctrl.status_code, 200)
        self.assertEqual(ctrl.json()["status"], "plan_to_read")
        self.assertFalse(ctrl.json()["notify_new_chapters"])

        # User 2 favorites same novel with notify enabled (default True)
        self._as_user(self.user2_ns)
        up2 = self.client.patch(
            "/favorites/guncelle",
            json={"novel_id": 1, "status": "reading"},
        )
        self.assertEqual(up2.status_code, 200)
        self.assertEqual(up2.json()["status"], "reading")
        self.assertTrue(up2.json()["notify_new_chapters"])

        # Filter /favorites/listele by status
        self._as_user(self.user1_ns)
        self.assertEqual(len(self.client.get("/favorites/listele?status=completed").json()), 0)
        self.assertEqual(len(self.client.get("/favorites/listele?status=plan_to_read").json()), 1)

        # Update user1 status & reject invalid status
        bad_up = self.client.patch("/favorites/guncelle", json={"novel_id": 1, "status": "unknown_status"})
        self.assertEqual(bad_up.status_code, 400)

        # Notify favorite users -> ONLY user2 gets notified (user1 muted!)
        db = self.SessionTesting()
        sent = notifications.notify_favorite_users_new_chapter(
            db,
            novel_id=1,
            series_title="Shadow Novel",
            chapter_label="Bölüm 2",
            link="/novel/shadow-novel/bolum/2",
        )
        db.commit()
        self.assertEqual(sent, 1)
        notified_uids = [n.user_id for n in db.query(models.Notification).all()]
        self.assertEqual(notified_uids, [4])
        db.close()

    def test_comments_v2_series_and_chapter_full_lifecycle(self):
        # Create 2 top-level series comments on webtoon 1
        self._as_user(self.user1_ns)
        c1 = self.client.post(
            "/comments/",
            json={"content": "İlk seri yorumu", "webtoon_id": 1, "is_spoiler": False},
        )
        self.assertEqual(c1.status_code, 201)
        c1_id = c1.json()["id"]

        self._as_user(self.user2_ns)
        c2 = self.client.post(
            "/comments/",
            json={"content": "Final spoiler!", "webtoon_id": 1, "is_spoiler": True},
        )
        self.assertEqual(c2.status_code, 201)
        c2_id = c2.json()["id"]

        # Reply to c1 by user2 -> triggers notification for user1 linking to /webtoon/solo-leveling#comment-...
        rep = self.client.post(
            "/comments/",
            json={"content": "Katılıyorum!", "parent_id": c1_id, "is_spoiler": False},
        )
        self.assertEqual(rep.status_code, 201)

        # Like c1 (now likes_count=1 for c1, 0 for c2)
        like_res = self.client.post(f"/comments/{c1_id}/like")
        self.assertEqual(like_res.status_code, 200)
        self.assertEqual(like_res.json(), {"liked": True, "likes_count": 1})

        # Report c2 by user1
        self._as_user(self.user1_ns)
        rep_res = self.client.post(f"/comments/{c2_id}/report", json={"reason": "Spoiler"})
        self.assertEqual(rep_res.status_code, 200)
        self.assertEqual(rep_res.json(), {"reported": True})

        # Verify GET /comments/series/webtoon/1 with sort=top, X-Total-Count=2, pagination, and full fields
        top_res = self.client.get("/comments/series/webtoon/1?limit=1&offset=0&sort=top")
        self.assertEqual(top_res.status_code, 200)
        self.assertEqual(top_res.headers.get("X-Total-Count"), "2")
        items = top_res.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], c1_id)
        self.assertEqual(items[0]["likes_count"], 1)
        self.assertEqual(items[0]["user_image"], "static/profile_images/r1.webp")
        self.assertEqual(len(items[0]["replies"]), 1)
        self.assertEqual(items[0]["replies"][0]["content"], "Katılıyorum!")

        # Check reported flag on c2
        all_res = self.client.get("/comments/series/webtoon/1?limit=20&sort=oldest")
        c2_obj = next(x for x in all_res.json() if x["id"] == c2_id)
        self.assertTrue(c2_obj["is_spoiler"])
        self.assertTrue(c2_obj["is_reported_by_me"])

        # Edit comment: author allowed -> sets updated_at; non-author forbidden (403)
        self.assertEqual(
            self.client.put(f"/comments/{c2_id}", json={"content": "hack"}).status_code,
            403,
        )
        self._as_user(self.user2_ns)
        edit_res = self.client.put(
            f"/comments/{c2_id}",
            json={"content": "Düzenlendi", "is_spoiler": False},
        )
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.json()["content"], "Düzenlendi")
        self.assertFalse(edit_res.json()["is_spoiler"])
        self.assertIsNotNone(edit_res.json()["updated_at"])

        # Admin reported_only=true + editor dismiss-reports
        self._as_user(self.admin_ns)
        adm_rep = self.client.get("/admin/comments?reported_only=true")
        self.assertEqual(adm_rep.status_code, 200)
        adm_data = adm_rep.json()["data"]
        self.assertEqual(len(adm_data), 1)
        self.assertEqual(adm_data[0]["id"], c2_id)
        self.assertEqual(adm_data[0]["report_count"], 1)
        self.assertEqual(adm_data[0]["latest_report_reason"], "Spoiler")
        self.assertEqual(adm_data[0]["target_label"], "Solo Leveling — Seri Sayfası")

        self._as_user(self.editor_ns)
        dis_res = self.client.post(f"/admin/comments/{c2_id}/dismiss-reports")
        self.assertEqual(dis_res.status_code, 200)
        self.assertEqual(dis_res.json()["dismissed"], 1)

        self._as_user(self.admin_ns)
        self.assertEqual(len(self.client.get("/admin/comments?reported_only=true").json()["data"]), 0)

        # Series novel comment check + chapter comment backward compatibility
        self._as_user(self.user1_ns)
        self.assertEqual(
            self.client.post("/comments/", json={"content": "Roman serisi!", "novel_id": 1}).status_code,
            201,
        )
        n_series = self.client.get("/comments/series/novel/1")
        self.assertEqual(n_series.status_code, 200)
        self.assertEqual(n_series.headers.get("X-Total-Count"), "1")

        # Delete comment tree
        self.assertEqual(self.client.delete(f"/comments/{c1_id}").status_code, 200)
        self.assertEqual(self.client.get("/comments/series/webtoon/1").headers.get("X-Total-Count"), "1")

    def test_smart_recommendations_scoring_cross_fallback_and_cache(self):
        # Reader1 favorites both Solo Leveling (w1) and Tower Climb (w2) -> strong co-favorite + shared Action/Fantasy!
        db = self.SessionTesting()
        db.add_all([
            models.Favorite(user_id=3, webtoon_id=1),
            models.Favorite(user_id=3, webtoon_id=2),
            models.Favorite(user_id=4, webtoon_id=1),
            models.Favorite(user_id=4, novel_id=1),
        ])
        db.commit()
        db.close()

        res = self.client.get("/recommendations/webtoon/solo-leveling?limit=6")
        self.assertEqual(res.status_code, 200)
        cards = res.json()
        # 2 other published webtoons (w2, w3; w_unpub excluded) + 2 cross-format published novels (n1, n2) = 4 total
        self.assertEqual(len(cards), 4)
        self.assertEqual(cards[0]["slug"], "tower-climb")
        self.assertEqual(cards[1]["slug"], "cozy-bake")
        self.assertEqual(cards[2]["slug"], "shadow-novel")  # cross-format ranked before oak-tree via shared cats + co-fav
        self.assertNotIn("hidden-w", [c["slug"] for c in cards])
        self.assertIn("1:6", "|".join(cache.recommendations_cache._cache.keys()))

    def test_alembic_004_chain_and_lf_script(self):
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
        heads = set(revs.keys()) - set(revs.values())
        self.assertEqual(heads, {"004_phase3_retention_community"})

        mig_bytes = (BACKEND_DIR / "scripts" / "migrate_phase3.sh").read_bytes()
        self.assertEqual(mig_bytes.count(b"\r"), 0)


if __name__ == "__main__":
    unittest.main()
