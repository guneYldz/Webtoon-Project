from fastapi import FastAPI, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from typing import Any
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from markupsafe import Markup

from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from starlette.datastructures import UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from database import engine, get_db
import models
import os
import signals
from utils.cache import invalidate_content_caches, vitrin_cache
from utils.media import delete_static_file_safe, validate_and_save_image
from wtforms import TextAreaField, FileField, Field
from wtforms.widgets import FileInput
import uuid

# --- ROUTERLARI ÇAĞIR ---
from routers import (
    auth,
    webtoon,
    episode,
    comments,
    favorites,
    likes,
    novel,
    admin as admin_router,
    notifications,
    reactions,
    sitemap,
    reading_progress,
    recommendations,
    ratings,
    chat,
)

# 1. Yeni dev ortamları için eksik tabloları oluştur (şema göçleri Alembic ile yönetilir)
models.Base.metadata.create_all(bind=engine)

# ⚠️ root_path="/api" KALDIRILDI (Starlette 0.50 uyumu):
# Nginx zaten /api önekini kırpıp backend'e öneksiz iletiyor.
# Yeni Starlette, root_path ayarlıyken öneksiz gelen isteklerde static mount
# yollarını yanlış hesaplıyordu → tüm resimler 404 veriyordu.
# Docs'un doğru URL göstermesi için "servers" ayarı yeterli.
app = FastAPI(
    title="Kaos Manga API",
    docs_url="/docs",
    openapi_url="/openapi.json",
    servers=[{"url": "https://kaosmanga.net/api"}]
)

# ==========================================
# 🚨 MIDDLEWARE AYARLARI
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment değişkeni bulunamadı!")

app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

_DEFAULT_CORS_ORIGINS = [
    "https://kaosmanga.net",
    "https://www.kaosmanga.net",
    "http://kaosmanga.net",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_EXTRA_CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_CORS_ORIGINS + _EXTRA_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
    expose_headers=["X-Total-Count"],
)

# ==========================================
# 🔐 GÜVENLİK VE GİRİŞ SİSTEMİ
# ==========================================
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        if not username or not password:
            return False

        with Session(engine) as session:
            user = session.query(models.User).filter(models.User.username == username).first()
            if not user or not user.is_active or user.role != "admin":
                return False

            password_valid = False
            try:
                if pwd_context.verify(password, user.password):
                    password_valid = True
            except Exception:
                password_valid = False

            if password_valid:
                token = jwt.encode(
                    {
                        "sub": str(user.id),
                        "type": "sqladmin",
                        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
                    },
                    SECRET_KEY,
                    algorithm="HS256",
                )
                request.session.update({"token": token})
                return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token or not isinstance(token, str):
            return False
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if payload.get("type") != "sqladmin":
                request.session.clear()
                return False
            user_id = int(payload.get("sub", ""))
        except (JWTError, ValueError, TypeError):
            request.session.clear()
            return False

        with Session(engine) as session:
            user = session.query(models.User).filter(models.User.id == user_id).first()
            if not user or not user.is_active or user.role != "admin":
                request.session.clear()
                return False
        return True

authentication_backend = AdminAuth(secret_key=SECRET_KEY)

# ==========================================
# 🛠️ ADMIN MODEL VIEWS (Webtoon, User, Novel vb.)
# ==========================================

class WebtoonAdmin(ModelView, model=models.Webtoon):
    name = "Seri"
    name_plural = "Seriler"
    icon = "fa-solid fa-book"
    column_list = [models.Webtoon.id, models.Webtoon.cover_image, models.Webtoon.title, models.Webtoon.type, models.Webtoon.categories, models.Webtoon.is_featured, models.Webtoon.is_published, models.Webtoon.view_count, models.Webtoon.status]
    form_ajax_refs = {"categories": {"fields": ("name",), "order_by": "name"}}
    form_overrides = {"cover_image": FileField, "banner_image": FileField}
    form_columns = ["title", "slug", "summary", "categories", "status", "type", "is_featured", "is_published", "cover_image", "banner_image", "source_url"]

    async def on_model_change(self, data, model, is_created, request):
        UPLOAD_DIR_COVERS = "static/covers"
        UPLOAD_DIR_BANNERS = "static/banners"
        for field in ["cover_image", "banner_image"]:
            val = data.get(field)
            if isinstance(val, UploadFile) and val.filename and val.size > 0:
                if not is_created and getattr(model, field):
                    delete_static_file_safe(getattr(model, field))
                folder = UPLOAD_DIR_COVERS if field == "cover_image" else UPLOAD_DIR_BANNERS
                prefix = "banner-" if field == "banner_image" else ""
                max_w = 1200 if field == "cover_image" else 1920
                data[field] = await run_in_threadpool(
                    validate_and_save_image, val, folder, 15 * 1024 * 1024, prefix, True, max_w
                )
            else:
                if field in data: del data[field]
        return await super().on_model_change(data, model, is_created, request)

    async def after_model_change(self, data, model, is_created, request):
        invalidate_content_caches()
        return await super().after_model_change(data, model, is_created, request)

    async def after_model_delete(self, model, request):
        invalidate_content_caches()
        return await super().after_model_delete(model, request)

    column_formatters = {
        models.Webtoon.cover_image: lambda m, a: Markup(f'<img src="/{m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover;">') if m.cover_image else "Yok",
        models.Webtoon.is_featured: lambda m, a: Markup('<span style="color:#f1c40f;">★</span>') if m.is_featured else '-',
        models.Webtoon.categories: lambda m, a: ", ".join([str(c.name) for c in m.categories if c]) if m.categories else "-"
    }

class EpisodeAdmin(ModelView, model=models.WebtoonEpisode):
    name = "Webtoon Bölümü"
    name_plural = "Webtoon Bölümleri"
    icon = "fa-solid fa-file-video"
    column_list = [models.WebtoonEpisode.id, models.WebtoonEpisode.webtoon, models.WebtoonEpisode.episode_number, models.WebtoonEpisode.title, models.WebtoonEpisode.is_published]

class EpisodeImageAdmin(ModelView, model=models.EpisodeImage):
    name = "Bölüm Resmi"
    name_plural = "Bölüm Resimleri"
    icon = "fa-solid fa-images"
    column_list = [models.EpisodeImage.id, models.EpisodeImage.episode, models.EpisodeImage.page_order]

class UserAdmin(ModelView, model=models.User):
    name = "Kullanıcı"
    name_plural = "Kullanıcılar"
    icon = "fa-solid fa-user"
    column_list = [models.User.id, models.User.username, models.User.role, models.User.is_active]

class CategoryAdmin(ModelView, model=models.Category):
    name = "Kategori"
    name_plural = "Kategoriler"
    icon = "fa-solid fa-list"
    column_list = [models.Category.id, models.Category.name]

class CommentAdmin(ModelView, model=models.Comment):
    name = "Yorum"
    name_plural = "Yorumlar"
    icon = "fa-solid fa-comments"
    column_list = [models.Comment.id, models.Comment.user, models.Comment.content, models.Comment.created_at]

class NovelAdmin(ModelView, model=models.Novel):
    name = "Roman"
    name_plural = "Romanlar"
    icon = "fa-solid fa-book-open"
    column_list = [models.Novel.id, models.Novel.cover_image, models.Novel.title, models.Novel.author, models.Novel.status, models.Novel.is_published]
    form_overrides = {"cover_image": FileField, "banner_image": FileField}
    form_columns = ["title", "slug", "author", "summary", "status", "is_featured", "is_published", "cover_image", "banner_image", "source_url"]

    async def on_model_change(self, data, model, is_created, request):
        UPLOAD_DIR_COVERS = "static/covers"
        UPLOAD_DIR_BANNERS = "static/banners"
        for field in ["cover_image", "banner_image"]:
            val = data.get(field)
            if isinstance(val, UploadFile) and val.filename and val.size > 0:
                if not is_created and getattr(model, field):
                    delete_static_file_safe(getattr(model, field))
                folder = UPLOAD_DIR_COVERS if field == "cover_image" else UPLOAD_DIR_BANNERS
                prefix = "novel-banner-" if field == "banner_image" else "novel-"
                max_w = 1200 if field == "cover_image" else 1920
                data[field] = await run_in_threadpool(
                    validate_and_save_image, val, folder, 15 * 1024 * 1024, prefix, True, max_w
                )
            else:
                if field in data: del data[field]
        return await super().on_model_change(data, model, is_created, request)

    async def after_model_change(self, data, model, is_created, request):
        invalidate_content_caches()
        return await super().after_model_change(data, model, is_created, request)

    async def after_model_delete(self, model, request):
        invalidate_content_caches()
        return await super().after_model_delete(model, request)

class NovelChapterAdmin(ModelView, model=models.NovelChapter):
    name = "Roman Bölümü"
    name_plural = "Roman Bölümleri"
    icon = "fa-solid fa-file-word"
    column_list = [models.NovelChapter.novel, models.NovelChapter.chapter_number, models.NovelChapter.title]
    form_overrides = {"content": TextAreaField}

# ==========================================
# 🚀 BAŞLATMA VE KONFİGÜRASYON
# ==========================================

# 1. Klasörleri kontrol et
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

for d in [os.path.join(STATIC_DIR, "covers"), os.path.join(STATIC_DIR, "banners"), os.path.join(STATIC_DIR, "images")]:
    if not os.path.exists(d): os.makedirs(d, exist_ok=True)

# 2. Resimler için MUTLAK VE ÇİFT MOUNT AYARI
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/api/static", StaticFiles(directory=STATIC_DIR), name="api_static")

# 3. SQLAdmin Kalbi
admin = Admin(app, engine, authentication_backend=authentication_backend, base_url="/db-admin")

# 4. Admin Görünümlerini Ekle
admin.add_view(UserAdmin)
admin.add_view(WebtoonAdmin)
admin.add_view(EpisodeAdmin)
admin.add_view(EpisodeImageAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(CommentAdmin)
admin.add_view(NovelAdmin)
admin.add_view(NovelChapterAdmin)

# 5. Routerları Dahil Et
app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router)
app.include_router(favorites.router)
app.include_router(likes.router)
app.include_router(novel.router)
app.include_router(admin_router.router)
app.include_router(notifications.router)
app.include_router(reactions.router)
app.include_router(sitemap.router)
app.include_router(reading_progress.router)
app.include_router(recommendations.router)
app.include_router(ratings.router)
app.include_router(chat.router)

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon, Manga & Novel API Hazır! 🚀"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


@app.get("/categories")
def public_categories(db: Session = Depends(get_db)):
    cats = db.query(models.Category).order_by(models.Category.name.asc()).all()
    return [{"id": c.id, "name": c.name} for c in cats]


@app.get("/vitrin")
def get_vitrin(db: Session = Depends(get_db)):
    cached = vitrin_cache.get("vitrin")
    if cached is not None:
        return cached

    try:
        featured_webtoons = (
            db.query(models.Webtoon)
            .filter(models.Webtoon.is_featured == True, models.Webtoon.is_published == True)
            .order_by(models.Webtoon.id.desc())
            .all()
        )
        featured_novels = (
            db.query(models.Novel)
            .filter(models.Novel.is_featured == True, models.Novel.is_published == True)
            .order_by(models.Novel.id.desc())
            .all()
        )
    except Exception:
        return []

    vitrin_listesi = []
    for w in featured_webtoons:
        vitrin_listesi.append({
            "id": w.id, "title": w.title, "slug": w.slug,
            "banner_image": w.banner_image, "cover_image": w.cover_image,
            "summary": w.summary, "view_count": w.view_count,
            "status": w.status,
            "type": "webtoon",
            "typeLabel": "MANGA" if str(getattr(w.type, "value", w.type) or "").upper() == "MANGA" else "WEBTOON",
            "bg_color": "orange" if str(getattr(w.type, "value", w.type) or "").upper() == "MANGA" else "blue",
        })
    for n in featured_novels:
        vitrin_listesi.append({
            "id": n.id, "title": n.title, "slug": n.slug,
            "banner_image": n.cover_image, "cover_image": n.cover_image,
            "summary": n.summary, "view_count": getattr(n, 'view_count', 0) or 0,
            "status": n.status or "ongoing", "type": "novel", "typeLabel": "NOVEL", "bg_color": "purple"
        })
    vitrin_listesi.sort(key=lambda item: (-int(item["id"]), item["type"]))
    vitrin_cache.set("vitrin", vitrin_listesi)
    return vitrin_listesi
