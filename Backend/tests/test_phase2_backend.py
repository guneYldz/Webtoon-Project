import ast
import asyncio
import io
import os
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_CONNECTION", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-phase2-unit-tests")

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

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
import main as app_main
import models
import signals  # noqa: F401
from routers import admin, notifications
from routers.auth import get_current_user
from utils import cache, media
from utils.view_tracker import ViewTracker


def _make_upload(raw_bytes: bytes, filename: str = "upload.png"):
    return types.SimpleNamespace(filename=filename, file=io.BytesIO(raw_bytes))


class TestPhase2MediaPipeline(unittest.TestCase):
    def test_webp_conversion_exif_downscale_and_alpha_preservation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            dest_covers = os.path.join(tmpdir, "static", "covers")

            # 1) Large rotated JPEG (width 2400 -> height 1200 before EXIF transpose; EXIF 6 rotates to 1200x2400 -> Wait: 3000x2000 rotated by 6 becomes 2000x3000, downscaled to max_width=1200 -> 1200x1800)
            jpg_img = Image.new("RGB", (3000, 2000), color=(220, 40, 40))
            exif = Image.Exif()
            exif[0x0112] = 6  # Orientation: Rotate 90 CW -> transposed size is (2000, 3000)
            jpg_buf = io.BytesIO()
            jpg_img.save(jpg_buf, format="JPEG", exif=exif.tobytes())

            saved_rel = media.validate_and_save_image(
                _make_upload(jpg_buf.getvalue(), "cover.jpg"),
                dest_covers,
                max_width=1200,
            )
            self.assertTrue(saved_rel.startswith("static/covers/") and saved_rel.endswith(".webp"))
            saved_abs = os.path.join(tmpdir, saved_rel.replace("/", os.sep))
            with Image.open(saved_abs) as out_img:
                self.assertEqual(out_img.format, "WEBP")
                self.assertEqual(out_img.size, (1200, 1800))

            # 2) Small RGBA PNG (never upscales, preserves alpha channel)
            rgba_img = Image.new("RGBA", (300, 200), color=(10, 120, 250, 128))
            png_buf = io.BytesIO()
            rgba_img.save(png_buf, format="PNG")
            saved_rgba = media.validate_and_save_image(
                _make_upload(png_buf.getvalue(), "avatar.png"),
                os.path.join(tmpdir, "static", "profile_images"),
                max_width=512,
            )
            self.assertTrue(saved_rgba.endswith(".webp"))
            rgba_abs = os.path.join(tmpdir, saved_rgba.replace("/", os.sep))
            with Image.open(rgba_abs) as out_rgba:
                self.assertEqual(out_rgba.format, "WEBP")
                self.assertEqual(out_rgba.size, (300, 200))
                self.assertEqual(out_rgba.mode, "RGBA")
                self.assertEqual(out_rgba.getpixel((0, 0))[3], 128)

            # 3) Animated GIF remains untouched .gif
            f1 = Image.new("P", (64, 64), color=1)
            f2 = Image.new("P", (64, 64), color=2)
            gif_buf = io.BytesIO()
            f1.save(gif_buf, format="GIF", save_all=True, append_images=[f2], duration=100, loop=0)
            saved_gif = media.validate_and_save_image(
                _make_upload(gif_buf.getvalue(), "anim.gif"),
                dest_covers,
                max_width=512,
            )
            self.assertTrue(saved_gif.endswith(".gif"))

    def test_svg_html_and_oversized_rejected(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaises(HTTPException) as svg_ctx:
                media.validate_and_save_image(
                    _make_upload(b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', "bad.svg"),
                    tmpdir,
                )
            self.assertEqual(svg_ctx.exception.status_code, 400)

            with self.assertRaises(HTTPException) as size_ctx:
                media.validate_and_save_image(
                    _make_upload(b"\x89PNG\r\n\x1a\n" + b"0" * 128, "big.png"),
                    tmpdir,
                    max_bytes=64,
                )
            self.assertEqual(size_ctx.exception.status_code, 413)

    def test_delete_static_file_safe_blocks_traversal_and_signals_cleanup(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            static_root = os.path.join(tmpdir, "static")
            covers_dir = os.path.join(static_root, "covers")
            os.makedirs(covers_dir, exist_ok=True)

            target_file = os.path.join(covers_dir, "orphan.webp")
            with open(target_file, "wb") as f:
                f.write(b"RIFF1234WEBP")

            outside_file = os.path.join(tmpdir, "outside.txt")
            with open(outside_file, "wb") as f:
                f.write(b"keep-me")

            self.assertFalse(media.delete_static_file_safe("static/../outside.txt", static_root=static_root))
            self.assertTrue(os.path.exists(outside_file))
            self.assertFalse(media.delete_static_file_safe("../outside.txt", static_root=static_root))
            self.assertFalse(media.delete_static_file_safe("/etc/passwd", static_root=static_root))
            self.assertFalse(media.delete_static_file_safe("https://cdn.example.com/static/covers/x.webp", static_root=static_root))
            self.assertFalse(media.delete_static_file_safe("static/", static_root=static_root))

            self.assertTrue(media.delete_static_file_safe("static/covers/orphan.webp", static_root=static_root))
            self.assertFalse(os.path.exists(target_file))

            # Signal after_delete for User & Announcement
            avatar_dir = os.path.join(static_root, "profile_images")
            ann_dir = os.path.join(static_root, "announcements")
            os.makedirs(avatar_dir, exist_ok=True)
            os.makedirs(ann_dir, exist_ok=True)
            avatar_file = os.path.join(avatar_dir, "u1.webp")
            ann_file = os.path.join(ann_dir, "a1.webp")
            with open(avatar_file, "wb") as f:
                f.write(b"x")
            with open(ann_file, "wb") as f:
                f.write(b"x")

            eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
            Sess = sessionmaker(autocommit=False, autoflush=False, bind=eng)
            models.Base.metadata.create_all(bind=eng)
            db = Sess()
            with patch.object(media, "STATIC_ROOT", os.path.realpath(static_root)):
                user = models.User(username="delu", email="delu@example.com", password="x", profile_image="static/profile_images/u1.webp")
                ann = models.Announcement(title="T", message="M", image="static/announcements/a1.webp")
                db.add_all([user, ann])
                db.commit()
                db.delete(user)
                db.delete(ann)
                db.commit()
            db.close()
            eng.dispose()
            self.assertFalse(os.path.exists(avatar_file))
            self.assertFalse(os.path.exists(ann_file))


class TestPhase2ApiAndBulkOps(unittest.TestCase):
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
        db = self.SessionTesting()
        for model in (
            models.Notification,
            models.Announcement,
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

        self.u_admin = models.User(id=1, username="adm", email="adm@example.com", password="x", role="admin", is_active=True)
        self.u_editor = models.User(id=2, username="edt", email="edt@example.com", password="x", role="editor", is_active=True)
        self.u_user = models.User(id=3, username="usr", email="usr@example.com", password="x", role="user", is_active=True)
        self.u_inactive = models.User(id=4, username="inact", email="inact@example.com", password="x", role="user", is_active=False)

        c_action = models.Category(id=1, name="Aksiyon")
        c_romance = models.Category(id=2, name="Romantik")

        w1 = models.Webtoon(id=1, title="Solo Hunter", slug="solo-hunter", summary="Aksiyon dolu seri", status="ongoing", is_published=True, is_featured=True, type=models.ContentType.WEBTOON)
        w2 = models.Webtoon(id=2, title="Completed Tale", slug="completed-tale", summary="Romantik hikaye", status="completed", is_published=True, is_featured=False, type=models.ContentType.MANGA)
        w_draft = models.Webtoon(id=3, title="Draft Series", slug="draft-series", summary="Taslak", status="ongoing", is_published=False, is_featured=True)

        n1 = models.Novel(id=1, title="Oak Tree Story", slug="oak-tree", author="Suji Kim", summary="Romantizm", status="ongoing", is_published=True, is_featured=True)
        n2 = models.Novel(id=2, title="Tyrant Defense", slug="tyrant-defense", author="Ryu", summary="Kule savunma", status="completed", is_published=True, is_featured=False)

        w1.categories = [c_action]
        w2.categories = [c_romance]
        n1.categories = [c_romance]
        n2.categories = [c_action]

        db.add_all([self.u_admin, self.u_editor, self.u_user, self.u_inactive, c_action, c_romance, w1, w2, w_draft, n1, n2])
        db.flush()

        db.add_all([
            models.Favorite(user_id=2, novel_id=1),
            models.Favorite(user_id=3, novel_id=1),
            models.Favorite(user_id=4, novel_id=1),  # inactive user should be ignored
        ])
        db.commit()
        db.close()

    def test_bulk_notifications_and_prune(self):
        db = self.SessionTesting()
        sent = notifications.notify_favorite_users_new_chapter(
            db,
            novel_id=1,
            series_title="Oak Tree Story",
            chapter_label="Bölüm 12",
            link="/novel/oak-tree/bolum/12",
        )
        db.commit()
        self.assertEqual(sent, 2)

        notifs = db.query(models.Notification).order_by(models.Notification.user_id.asc()).all()
        self.assertEqual(len(notifs), 2)
        self.assertEqual(notifs[0].title, "Oak Tree Story — yeni bölüm")
        self.assertFalse(notifs[0].title.startswith("📚"))
        self.assertFalse(notifs[0].is_read)

        sent_all = notifications.notify_all_active_users(
            db,
            type_="announcement",
            title="Sistem Güncellemesi",
            message="Yeni sürüm yayında.",
            link="/duyurular#duyuru-1",
        )
        db.commit()
        self.assertEqual(sent_all, 3)  # admin, editor, user (inactive excluded)

        # Prune old read notifications (> 90 days)
        old_time = datetime.utcnow() - timedelta(days=120)
        recent_time = datetime.utcnow() - timedelta(days=5)
        db.add_all([
            models.Notification(user_id=3, type="announcement", title="Old Read", message="x", is_read=True, created_at=old_time),
            models.Notification(user_id=3, type="announcement", title="Old Unread", message="x", is_read=False, created_at=old_time),
            models.Notification(user_id=3, type="announcement", title="Recent Read", message="x", is_read=True, created_at=recent_time),
        ])
        db.commit()

        deleted = notifications.prune_old_read_notifications(db, older_than_days=90)
        db.commit()
        self.assertEqual(deleted, 1)
        remaining_titles = {n.title for n in db.query(models.Notification).all()}
        self.assertNotIn("Old Read", remaining_titles)
        self.assertIn("Old Unread", remaining_titles)
        self.assertIn("Recent Read", remaining_titles)
        db.close()

    def test_health_vitrin_cache_and_invalidation(self):
        health_res = self.client.get("/health")
        self.assertEqual(health_res.status_code, 200)
        self.assertEqual(health_res.json(), {"status": "ok"})

        res1 = self.client.get("/vitrin")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(len(res1.json()), 2)

        # Mutate DB directly without clearing cache -> hit proves cached 2 items
        db = self.SessionTesting()
        db.add(models.Webtoon(id=99, title="Hidden From Cache", slug="hidden-cache", summary="s", is_published=True, is_featured=True))
        db.commit()
        db.close()

        res2 = self.client.get("/vitrin")
        self.assertEqual(len(res2.json()), 2)

        cache.invalidate_vitrin_cache()
        res3 = self.client.get("/vitrin")
        self.assertEqual(len(res3.json()), 3)

    def test_admin_options_auth_shape_and_stats_cache(self):
        # Unauthenticated -> 401
        self.app.dependency_overrides.pop(get_current_user, None)
        self.assertEqual(self.client.get("/admin/options/webtoons").status_code, 401)

        user_obj = types.SimpleNamespace(id=3, username="usr", email="usr@example.com", role="user", is_active=True)
        editor_obj = types.SimpleNamespace(id=2, username="edt", email="edt@example.com", role="editor", is_active=True)
        admin_obj = types.SimpleNamespace(id=1, username="adm", email="adm@example.com", role="admin", is_active=True)

        # Standard user -> 403
        self.app.dependency_overrides[get_current_user] = lambda: user_obj
        self.assertEqual(self.client.get("/admin/options/webtoons").status_code, 403)
        self.assertEqual(self.client.get("/admin/options/novels").status_code, 403)

        # Editor -> 200
        self.app.dependency_overrides[get_current_user] = lambda: editor_obj
        w_opts = self.client.get("/admin/options/webtoons")
        self.assertEqual(w_opts.status_code, 200)
        self.assertEqual(len(w_opts.json()), 3)
        self.assertEqual(set(w_opts.json()[0].keys()), {"id", "title", "slug", "type", "is_published"})

        n_opts = self.client.get("/admin/options/novels")
        self.assertEqual(n_opts.status_code, 200)
        self.assertEqual(len(n_opts.json()), 2)
        self.assertEqual(set(n_opts.json()[0].keys()), {"id", "title", "slug", "is_published"})

        # Admin -> /admin/stats cache & /admin/announcements bulk notification
        self.app.dependency_overrides[get_current_user] = lambda: admin_obj
        stats_res = self.client.get("/admin/stats")
        self.assertEqual(stats_res.status_code, 200)
        self.assertIn("stats", cache.admin_stats_cache)

        db = self.SessionTesting()
        try:
            ann_res = asyncio.run(
                admin.create_announcement(
                    title="Duyuru 1",
                    message="Detaylar",
                    link=None,
                    image=None,
                    db=db,
                    current_admin=admin_obj,
                )
            )
        finally:
            db.close()
        self.assertEqual(ann_res["sent_to"], 3)
        self.assertNotIn("stats", cache.admin_stats_cache)
        self.app.dependency_overrides.pop(get_current_user, None)

    def test_webtoon_and_novel_filtering_and_total_count_header(self):
        # Webtoons filtered by category_id & status
        w_all = self.client.get("/webtoons/?limit=1&skip=0")
        self.assertEqual(w_all.status_code, 200)
        self.assertEqual(len(w_all.json()), 1)
        self.assertEqual(w_all.headers.get("X-Total-Count"), "2")

        w_cat = self.client.get("/webtoons?category_id=2&status=completed")
        self.assertEqual(w_cat.status_code, 200)
        self.assertEqual(w_cat.headers.get("X-Total-Count"), "1")
        self.assertEqual(w_cat.json()[0]["slug"], "completed-tale")

        # Novels filtered by search & limit=1000 compatibility
        n_search = self.client.get("/novels/?search=Tyrant&limit=1000")
        self.assertEqual(n_search.status_code, 200)
        self.assertEqual(n_search.headers.get("X-Total-Count"), "1")
        self.assertEqual(n_search.json()[0]["slug"], "tyrant-defense")


class TestPhase2ViewTrackerAndAlembic(unittest.TestCase):
    def test_view_tracker_memory_and_postgres_fallback(self):
        vt = ViewTracker(ttl_seconds=60, cleanup_interval_seconds=60)
        self.assertEqual(vt.get_stats()["backend"], "memory")
        self.assertTrue(vt.should_count_view("1.2.3.4", "novel", 10))
        self.assertFalse(vt.should_count_view("1.2.3.4", "novel", 10))
        self.assertTrue(vt.should_count_view("5.6.7.8", "novel", 10))

        # Mocked PostgreSQL connection verifies SQL upsert + graceful fallback
        mock_conn = MagicMock()
        mock_conn.execute.return_value.first.return_value = ("novel:10:1.2.3.4",)
        mock_engine = MagicMock()
        mock_engine.dialect.name = "postgresql"
        mock_engine.begin.return_value.__enter__.return_value = mock_conn

        vt_pg = ViewTracker(ttl_seconds=60, cleanup_interval_seconds=60)
        with patch.object(database, "engine", mock_engine):
            self.assertTrue(vt_pg.should_count_view("1.2.3.4", "novel", 10))
            sql_text = str(mock_conn.execute.call_args_list[0][0][0])
            self.assertIn("ON CONFLICT (dedupe_key) DO UPDATE", sql_text)
            self.assertIn("WHERE view_dedupe.expires_at < NOW()", sql_text)

            # Duplicate returns no row -> False
            mock_conn.execute.return_value.first.return_value = None
            self.assertFalse(vt_pg.should_count_view("1.2.3.4", "novel", 10))

            # SQLAlchemyError falls back gracefully to in-memory dedupe
            mock_engine.begin.side_effect = OperationalError("SELECT 1", {}, Exception("no such table"))
            self.assertTrue(vt_pg.should_count_view("9.9.9.9", "novel", 11))
            self.assertFalse(vt_pg.should_count_view("9.9.9.9", "novel", 11))

    def test_alembic_single_head_chain(self):
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

        self.assertIn("001_phase1_schema_and_indexes", revs)
        self.assertEqual(revs.get("002_seo_sitemap_indexes"), "001_phase1_schema_and_indexes")
        self.assertEqual(revs.get("003_phase2_view_dedupe"), "002_seo_sitemap_indexes")
        heads = set(revs.keys()) - set(revs.values())
        self.assertEqual(len(heads), 1)


if __name__ == "__main__":
    unittest.main()
