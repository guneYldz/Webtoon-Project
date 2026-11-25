import json
import os
import sys
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_CONNECTION", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")

# Host Python may lack container-only packages (nh3, email_validator); stub only if absent
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

try:
    import python_multipart  # noqa: F401
except ImportError:
    try:
        import multipart  # noqa: F401
    except ImportError:
        import fastapi.dependencies.utils as _fdu
        _fdu.ensure_multipart_is_installed = lambda: None

from fastapi import BackgroundTasks, FastAPI, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request
from starlette.responses import Response

import database
import models
import schemas
from routers import comments, episode, novel, sitemap, webtoon
from utils.chapter_title import clean_chapter_number, format_chapter_number
from utils.query_helpers import parse_pg_int, to_utc_iso
from utils.view_tracker import ViewTracker, is_bot_request, schedule_view_increment, should_skip_view_tracking


def _make_request(headers=None, query_string="", client_host="203.0.113.10"):
    raw_headers = [
        (k.lower().encode("latin-1"), v.encode("latin-1"))
        for k, v in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "query_string": query_string.encode("latin-1"),
        "headers": raw_headers,
        "client": (client_host, 12345),
    }
    return Request(scope)


class TestSeoHelpers(unittest.TestCase):
    def test_clean_and_format_chapter_number(self):
        self.assertEqual(clean_chapter_number(1.0), 1)
        self.assertIsInstance(clean_chapter_number(1.0), int)
        self.assertEqual(clean_chapter_number(12.5), 12.5)
        self.assertIsInstance(clean_chapter_number(12.5), float)
        self.assertEqual(clean_chapter_number(None), 0)

        self.assertEqual(format_chapter_number(1.0), "1")
        self.assertEqual(format_chapter_number(12.5), "12.5")

    def test_parse_pg_int(self):
        self.assertEqual(parse_pg_int("1"), 1)
        self.assertEqual(parse_pg_int("2147483647"), 2147483647)
        self.assertIsNone(parse_pg_int("0"))
        self.assertIsNone(parse_pg_int("-5"))
        self.assertIsNone(parse_pg_int("2147483648"))
        self.assertIsNone(parse_pg_int("9999999999999"))
        self.assertIsNone(parse_pg_int("shadow-slave"))

    def test_to_utc_iso(self):
        dt = datetime(2026, 11, 25, 12, 30, 0)
        self.assertEqual(to_utc_iso(dt), "2026-11-25T12:30:00Z")
        self.assertIsNone(to_utc_iso(None))

    def test_schema_number_normalization(self):
        ch = schemas.NovelChapterListSchema(
            id=1, chapter_number=1.0, title="Bölüm 1", is_published=True
        )
        self.assertEqual(ch.chapter_number, 1)
        self.assertIsInstance(ch.chapter_number, int)

        ep = schemas.EpisodeListSchema(
            id=2, title="Bölüm 2.5", episode_number=2.5, is_published=True
        )
        self.assertEqual(ep.episode_number, 2.5)


class TestViewTracking(unittest.TestCase):
    def test_skip_rules_for_ssr_query_and_bots(self):
        ssr_req = _make_request(headers={"X-Internal-SSR": "1", "User-Agent": "node"})
        self.assertTrue(should_skip_view_tracking(ssr_req))

        optout_req = _make_request(query_string="track_view=false", headers={"User-Agent": "Mozilla/5.0"})
        self.assertTrue(should_skip_view_tracking(optout_req))

        bot_req = _make_request(headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"})
        self.assertTrue(is_bot_request(bot_req))
        self.assertTrue(should_skip_view_tracking(bot_req))

        human_req = _make_request(headers={"User-Agent": "Mozilla/5.0", "CF-Connecting-IP": "198.51.100.42"})
        self.assertFalse(should_skip_view_tracking(human_req))

    def test_view_tracker_cleanup_throttling(self):
        vt = ViewTracker(ttl_seconds=10, cleanup_interval_seconds=60)
        self.assertTrue(vt.should_count_view("1.1.1.1", "novel", 1))
        self.assertFalse(vt.should_count_view("1.1.1.1", "novel", 1))
        vt.views[("2.2.2.2", "novel", 2)] = datetime.now() - timedelta(seconds=30)
        # Cleanup shouldn't run immediately if interval hasn't elapsed
        vt.should_count_view("3.3.3.3", "novel", 3)
        self.assertIn(("2.2.2.2", "novel", 2), vt.views)
        # Force cleanup interval elapsed
        vt.last_cleanup = datetime.now() - timedelta(seconds=120)
        vt.should_count_view("4.4.4.4", "novel", 4)
        self.assertNotIn(("2.2.2.2", "novel", 2), vt.views)


class TestDatabaseBackedEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        models.Base.metadata.create_all(bind=cls.engine)
        cls._orig_session_local = database.SessionLocal
        database.SessionLocal = cls.SessionTesting

        db = cls.SessionTesting()
        try:
            t0 = datetime(2026, 10, 1, 10, 0, 0)
            t1 = datetime(2026, 11, 1, 12, 0, 0)
            t2 = datetime(2026, 11, 20, 15, 30, 0)

            n1 = models.Novel(id=1, title="Shadow Slave", slug="shadow-slave", summary="s", is_published=True, created_at=t0, view_count=10)
            n2 = models.Novel(id=2, title="Draft Novel", slug="draft-novel", summary="s", is_published=False, created_at=t0)
            db.add_all([n1, n2])
            db.flush()

            ch1 = models.NovelChapter(id=10, novel_id=1, chapter_number=1.0, title="Başlangıç", content="<p>Birinci</p>", is_published=True, created_at=t1, view_count=None)
            ch2 = models.NovelChapter(id=11, novel_id=1, chapter_number=12.5, title="Ara", content="<p>Ara</p>", is_published=True, created_at=t2, view_count=3)
            ch_draft = models.NovelChapter(id=12, novel_id=1, chapter_number=13.0, title="Taslak", content="<p>Gizli</p>", is_published=False, created_at=t2)
            ch_unpub_novel = models.NovelChapter(id=13, novel_id=2, chapter_number=1.0, title="Draft", content="<p>x</p>", is_published=True, created_at=t1)
            db.add_all([ch1, ch2, ch_draft, ch_unpub_novel])

            w1 = models.Webtoon(id=1, title="Solo Leveling", slug="solo-leveling", summary="s", is_published=True, created_at=t0, view_count=20)
            w2 = models.Webtoon(id=2, title="Draft Webtoon", slug="draft-webtoon", summary="s", is_published=False, created_at=t0)
            db.add_all([w1, w2])
            db.flush()

            ep1 = models.WebtoonEpisode(id=101, webtoon_id=1, episode_number=1.0, title="Bölüm 1", is_published=True, created_at=t1, view_count=7)
            ep2 = models.WebtoonEpisode(id=102, webtoon_id=1, episode_number=2.5, title="Özel", is_published=True, created_at=t2, view_count=2)
            ep_draft = models.WebtoonEpisode(id=103, webtoon_id=1, episode_number=3.0, title="Taslak", is_published=False, created_at=t2)
            db.add_all([ep1, ep2, ep_draft])

            u1 = models.User(id=1, username="okur1", email="o1@example.com", password="x", role="user")
            db.add(u1)
            db.flush()
            c1 = models.Comment(id=1, user_id=1, novel_chapter_id=10, content="Harika bölüm!", created_at=t1)
            db.add(c1)

            db.commit()
        finally:
            db.close()

    @classmethod
    def tearDownClass(cls):
        database.SessionLocal = cls._orig_session_local
        cls.engine.dispose()

    def setUp(self):
        self.db = self.SessionTesting()

    def tearDown(self):
        self.db.close()

    def test_sitemap_data_payload_and_schema(self):
        payload = sitemap.build_sitemap_payload(self.db)
        self.assertEqual(len(payload["novels"]), 1)
        self.assertEqual(len(payload["webtoons"]), 1)

        n = payload["novels"][0]
        self.assertEqual(n["slug"], "shadow-slave")
        self.assertEqual(n["updated_at"], "2026-11-20T15:30:00Z")
        self.assertEqual(
            n["chapters"],
            [
                {"chapter_number": "1", "created_at": "2026-10-01T10:00:00Z".replace("10-01T10:00:00", "11-01T12:00:00")},
                {"chapter_number": "12.5", "created_at": "2026-11-20T15:30:00Z"},
            ],
        )

        w = payload["webtoons"][0]
        self.assertEqual(w["slug"], "solo-leveling")
        self.assertEqual(w["updated_at"], "2026-11-20T15:30:00Z")
        self.assertEqual(
            w["episodes"],
            [
                {"id": 101, "episode_number": "1", "created_at": "2026-11-01T12:00:00Z"},
                {"id": 102, "episode_number": "2.5", "created_at": "2026-11-20T15:30:00Z"},
            ],
        )

    def test_novel_chapter_read_serialization_and_guards(self):
        req = _make_request(headers={"X-Internal-SSR": "1"})
        resp = Response()
        bg = BackgroundTasks()

        data = novel.novel_bolum_oku(
            slug="shadow-slave",
            chapter_identifier="1.0",
            request=req,
            response=resp,
            background_tasks=bg,
            db=self.db,
            current_user=None,
        )
        self.assertEqual(data["novel_slug"], "shadow-slave")
        self.assertEqual(data["chapter_number"], 1)
        self.assertIsInstance(data["chapter_number"], int)
        self.assertEqual(data["next_chapter"], 12.5)
        self.assertIsNone(data["prev_chapter"])
        self.assertEqual(len(bg.tasks), 0)  # SSR request must NOT schedule DB write

        # nan / inf must return 404, not 500
        for bad in ("nan", "inf", "-inf", "9999999999999"):
            with self.assertRaises(HTTPException) as ctx:
                novel.novel_bolum_oku(
                    slug="shadow-slave",
                    chapter_identifier=bad,
                    request=req,
                    response=resp,
                    background_tasks=BackgroundTasks(),
                    db=self.db,
                    current_user=None,
                )
            self.assertEqual(ctx.exception.status_code, 404)

    def test_detail_out_of_range_id_returns_404(self):
        req = _make_request(headers={"X-Internal-SSR": "1"})
        resp = Response()
        with self.assertRaises(HTTPException) as ctx1:
            novel.novel_detay("9999999999999", resp, req, BackgroundTasks(), self.db)
        self.assertEqual(ctx1.exception.status_code, 404)

        with self.assertRaises(HTTPException) as ctx2:
            webtoon.webtoon_detay("9999999999999", resp, req, BackgroundTasks(), self.db)
        self.assertEqual(ctx2.exception.status_code, 404)

    def test_episode_read_normalizes_episode_number_and_skips_bot_view(self):
        req = _make_request(headers={"User-Agent": "Googlebot/2.1"})
        resp = Response()
        bg = BackgroundTasks()
        data = episode.bolum_oku(101, req, resp, bg, self.db)
        self.assertEqual(data["webtoon_slug"], "solo-leveling")
        self.assertEqual(data["episode_number"], 1)
        self.assertIsInstance(data["episode_number"], int)
        self.assertEqual(data["next_episode_id"], 102)
        self.assertIsNone(data["prev_episode_id"])
        self.assertEqual(len(bg.tasks), 0)

    def test_comment_link_no_dot_zero(self):
        c = self.db.query(models.Comment).filter(models.Comment.id == 1).first()
        info = comments._seri_bilgisi(c)
        self.assertEqual(info["link"], "/novel/shadow-slave/bolum/1")

    def test_novel_detay_and_webtoon_detay_normalize_numbers_and_skip_ssr_views(self):
        req = _make_request(headers={"X-Internal-SSR": "1"})
        resp = Response()

        bg_n = BackgroundTasks()
        nd = novel.novel_detay("shadow-slave", resp, req, bg_n, self.db)
        self.assertEqual(nd.slug, "shadow-slave")
        self.assertEqual([c.chapter_number for c in nd.chapters], [1, 12.5])
        self.assertIsInstance(nd.chapters[0].chapter_number, int)
        self.assertEqual(len(bg_n.tasks), 0)

        bg_w = BackgroundTasks()
        wd = webtoon.webtoon_detay("solo-leveling", resp, req, bg_w, self.db)
        self.assertEqual(wd.slug, "solo-leveling")
        self.assertEqual([e.episode_number for e in wd.episodes], [1, 2.5])
        self.assertIsInstance(wd.episodes[0].episode_number, int)
        self.assertEqual(len(bg_w.tasks), 0)

    def test_human_view_schedules_background_task_and_increments_db(self):
        req = _make_request(headers={"User-Agent": "Mozilla/5.0", "CF-Connecting-IP": "198.51.100.77"})
        resp = Response()
        bg = BackgroundTasks()
        data = novel.novel_bolum_oku(
            slug="shadow-slave",
            chapter_identifier="1",
            request=req,
            response=resp,
            background_tasks=bg,
            db=self.db,
            current_user=None,
        )
        self.assertEqual(data["view_count"], 1)
        self.assertEqual(len(bg.tasks), 1)
        # Execute scheduled background task and confirm DB persisted view_count (including NULL -> 1 via COALESCE)
        task = bg.tasks[0]
        task.func(*task.args, **task.kwargs)
        self.db.expire_all()
        ch = self.db.query(models.NovelChapter).filter(models.NovelChapter.id == 10).first()
        self.assertEqual(ch.view_count, 1)

    def test_fastapi_sitemap_route_integration(self):
        from fastapi.testclient import TestClient

        test_app = FastAPI()
        test_app.include_router(sitemap.router)
        test_app.include_router(webtoon.router)

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        test_app.dependency_overrides[database.get_db] = override_get_db
        client = TestClient(test_app)

        res = client.get("/sitemap-data")
        self.assertEqual(res.status_code, 200)
        self.assertIn("max-age=60", res.headers.get("cache-control", ""))
        body = res.json()
        self.assertEqual(body["novels"][0]["chapters"][0]["chapter_number"], "1")
        self.assertEqual(body["webtoons"][0]["episodes"][0]["episode_number"], "1")

        # Verify /webtoons without trailing slash does not 307 redirect
        res_w = client.get("/webtoons", follow_redirects=False)
        self.assertEqual(res_w.status_code, 200)

    def test_multi_chapter_prev_next_navigation_does_not_raise_multiple_results(self):
        t = datetime(2026, 11, 22, 10, 0, 0)
        n_multi = models.Novel(id=3, title="Multi Chapter Novel", slug="multi-chapter-novel", summary="s", is_published=True, created_at=t)
        w_multi = models.Webtoon(id=3, title="Multi Chapter Webtoon", slug="multi-chapter-webtoon", summary="s", is_published=True, created_at=t)
        self.db.add_all([n_multi, w_multi])
        self.db.flush()

        n_chapters = [
            models.NovelChapter(id=20 + i, novel_id=3, chapter_number=float(i), title=f"Bölüm {i}", content=f"<p>{i}</p>", is_published=True, created_at=t)
            for i in range(1, 5)
        ]
        w_episodes = [
            models.WebtoonEpisode(id=200 + i, webtoon_id=3, episode_number=float(i), title=f"Bölüm {i}", is_published=True, created_at=t)
            for i in range(1, 5)
        ]
        self.db.add_all(n_chapters + w_episodes)
        self.db.commit()

        try:
            req = _make_request(headers={"X-Internal-SSR": "1"})
            resp = Response()

            expected_novels = [
                ("1", None, 2),
                ("2", 1, 3),
                ("3", 2, 4),
                ("4", 3, None),
            ]
            for ch_num, exp_prev, exp_next in expected_novels:
                data = novel.novel_bolum_oku(
                    slug="multi-chapter-novel",
                    chapter_identifier=ch_num,
                    request=req,
                    response=resp,
                    background_tasks=BackgroundTasks(),
                    db=self.db,
                    current_user=None,
                )
                self.assertEqual(data["prev_chapter"], exp_prev)
                self.assertEqual(data["next_chapter"], exp_next)

            expected_episodes = [
                (201, None, 202),
                (202, 201, 203),
                (203, 202, 204),
                (204, 203, None),
            ]
            for ep_id, exp_prev_id, exp_next_id in expected_episodes:
                ep_data = episode.bolum_oku(ep_id, req, resp, BackgroundTasks(), self.db)
                self.assertEqual(ep_data["prev_episode_id"], exp_prev_id)
                self.assertEqual(ep_data["next_episode_id"], exp_next_id)
        finally:
            self.db.query(models.NovelChapter).filter(models.NovelChapter.novel_id == 3).delete()
            self.db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.webtoon_id == 3).delete()
            self.db.query(models.Novel).filter(models.Novel.id == 3).delete()
            self.db.query(models.Webtoon).filter(models.Webtoon.id == 3).delete()
            self.db.commit()


if __name__ == "__main__":
    unittest.main()
