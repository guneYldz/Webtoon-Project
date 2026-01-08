from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from markupsafe import Markup
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from routers import novel
from passlib.context import CryptContext
from database import engine
import models
import os
import shutil
import uuid
from wtforms import FileField
from wtforms.validators import Optional
from sqlalchemy import Column, Integer, String, Text # <-- Buraya Text ekledik

# --- ROUTERLARI ÇAĞIR ---
from routers import auth, webtoon, episode, comments, favorites, likes

# 1. Tabloları oluştur
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# ==========================================
# 🚨 MIDDLEWARE AYARLARI
# ==========================================
SECRET_KEY = "cok_gizli_ve_karmasik_bir_sifre_buraya_yazilacak"
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

        with Session(engine) as session:
            user = session.query(models.User).filter(models.User.username == username).first()

            if user:
                password_valid = False
                try:
                    if pwd_context.verify(password, user.password):
                        password_valid = True
                except Exception:
                    pass

                if not password_valid and user.password == password:
                    password_valid = True

                if password_valid and user.role == "admin":
                    request.session.update({"token": f"admin_token_{user.id}"})
                    return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        return bool(token)

authentication_backend = AdminAuth(secret_key=SECRET_KEY)

# ==========================================
# 🛠️ ADMIN MODELLERİ
# ==========================================

class WebtoonAdmin(ModelView, model=models.Webtoon):
    name = "Seri"
    name_plural = "Seriler"
    icon = "fa-solid fa-book"
    
    column_list = [
        models.Webtoon.id, 
        models.Webtoon.cover_image, 
        models.Webtoon.banner_image,
        models.Webtoon.title, 
        models.Webtoon.categories, 
        models.Webtoon.is_featured, 
        models.Webtoon.view_count, 
        models.Webtoon.status
    ]

    # Teknik alanları gizle, resim yolları yazı olarak girilecek
    form_excluded_columns = [
        models.Webtoon.id,
        models.Webtoon.created_at,  
        models.Webtoon.view_count,  
        models.Webtoon.episodes,    
        models.Webtoon.favorites,
        models.Webtoon.category_links
    ]

    column_formatters = {
        models.Webtoon.cover_image: lambda m, a: Markup(
            f'<img src="{("/" + m.cover_image) if m.cover_image and not m.cover_image.startswith("/") else m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image else "Yok",
        
        models.Webtoon.banner_image: lambda m, a: Markup(
            f'<img src="{("/" + m.banner_image) if m.banner_image and not m.banner_image.startswith("/") else m.banner_image}" width="100" height="40" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.banner_image else "-",

        models.Webtoon.is_featured: lambda m, a: Markup(
            '<span style="color:#f1c40f; font-weight:bold;">★</span>' 
            if m.is_featured else '-'
        ),

        models.Webtoon.categories: lambda m, a: ", ".join([c.name for c in m.categories]) if m.categories else "-"
    }

class EpisodeAdmin(ModelView, model=models.Episode):
    name = "Bölüm"
    name_plural = "Bölümler"
    icon = "fa-solid fa-file-lines"
    column_list = [models.Episode.id, models.Episode.webtoon, models.Episode.episode_number, models.Episode.title]
    list_per_page = 20

class UserAdmin(ModelView, model=models.User):
    name = "Kullanıcı"
    name_plural = "Kullanıcılar"
    icon = "fa-solid fa-user"
    column_list = [models.User.id, models.User.username, models.User.role, models.User.is_active]
    
    column_formatters = {
        models.User.is_active: lambda m, a: Markup(
            '<span style="color:white; background-color:#2ecc71; padding:2px 8px; border-radius:4px;">AKTİF</span>' 
            if m.is_active else '<span style="color:white; background-color:#e74c3c; padding:2px 8px; border-radius:4px;">BANLI 🚫</span>'
        ),
        models.User.role: lambda m, a: Markup(
            f'<span style="color:white; background-color:{"#d63939" if m.role == "admin" else "#4299e1"}; padding:2px 8px; border-radius:4px;">{m.role.upper()}</span>'
        )
    }

class CategoryAdmin(ModelView, model=models.Category):
    name = "Kategori"
    name_plural = "Kategoriler"
    icon = "fa-solid fa-list"
    column_list = [models.Category.id, models.Category.name]

class CommentAdmin(ModelView, model=models.Comment):
    name = "Yorum"
    name_plural = "Yorumlar"
    icon = "fa-solid fa-comments"
    column_list = [models.Comment.user, models.Comment.content]

# 📖 ROMAN (NOVEL) YÖNETİMİ
class NovelAdmin(ModelView, model=models.Novel):
    name = "Roman"
    name_plural = "Romanlar"
    icon = "fa-solid fa-book-open"
    
    # Listeleme ekranında editörün işini kolaylaştıralım
    column_list = [
        models.Novel.id, 
        models.Novel.cover_image, 
        models.Novel.title, 
        models.Novel.author, 
        models.Novel.status,
    ]

    # Formda nelerin görüneceğini belirleyelim
    form_columns = [
        "title",
        "slug",
        "author",
        "summary",
        "status",
        "cover_image" # Webtoon ile aynı sade mantık: dosya yolu yazılacak
    ]

    column_formatters = {
        models.Novel.cover_image: lambda m, a: Markup(
            f'<img src="{("/" + m.cover_image) if m.cover_image and not m.cover_image.startswith("/") else m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image else "Yok",
        
        models.Novel.status: lambda m, a: Markup(
            f'<span style="color:white; background-color:{"#27ae60" if m.status == "ongoing" else "#e67e22"}; padding:2px 8px; border-radius:4px; font-size:12px;">{m.status.upper()}</span>'
        )
    }

    # Resim Önizleme (Webtoon ile aynı güvenli mantık)
    column_formatters = {
        models.Novel.cover_image: lambda m, a: Markup(
            f'<img src="{("/" + m.cover_image) if m.cover_image and not m.cover_image.startswith("/") else m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image else "Yok",
        
        models.Novel.status: lambda m, a: Markup(
            f'<span style="color:white; background-color:{"#27ae60" if m.status == "ongoing" else "#e67e22"}; padding:2px 8px; border-radius:4px; font-size:12px;">{m.status.upper()}</span>'
        )
    }

class NovelChapterAdmin(ModelView, model=models.NovelChapter):
    name = "Roman Bölümü"
    name_plural = "Roman Bölümleri"
    icon = "fa-solid fa-file-word"
    
    column_list = [
        models.NovelChapter.novel, 
        models.NovelChapter.chapter_number, 
        models.NovelChapter.title
    ]

    # 👇 KRİTİK: Editörün uzun metinleri rahat girmesi için 'TextArea' kullanıyoruz
    form_overrides = {
        "content": Text  # SQLAdmin otomatik olarak geniş bir yazı alanı sağlar
    }

    # Bölüm eklerken hangi alanlar dolsun?
    form_columns = [
        "novel",
        "chapter_number",
        "title",
        "content"
    ]

    # Editörlerin arama yapabilmesi için
    column_searchable_list = [models.NovelChapter.title]
# ==========================================
# 🚀 BAŞLATMA
# ==========================================

if not os.path.exists("static/covers"): os.makedirs("static/covers")
if not os.path.exists("static/banners"): os.makedirs("static/banners")
if not os.path.exists("static/images"): os.makedirs("static/images")

app.mount("/static", StaticFiles(directory="static"), name="static")

admin = Admin(app, engine, authentication_backend=authentication_backend)

# Admin Görünümlerini Ekle
admin.add_view(UserAdmin)
admin.add_view(WebtoonAdmin)
admin.add_view(EpisodeAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(CommentAdmin)
admin.add_view(NovelAdmin)       # <-- Artık burada hata vermez
admin.add_view(NovelChapterAdmin) # <-- Artık burada hata vermez

# Routerları Dahil Et
app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router)
app.include_router(favorites.router)
app.include_router(likes.router)
app.include_router(novel.router)

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon API Hazır! 🚀"}