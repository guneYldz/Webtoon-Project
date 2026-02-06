from fastapi import FastAPI, Depends, HTTPException
from typing import Any
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from markupsafe import Markup


# ==========================================
# 🛠️ GÜVENLİ MODEL VIEW (SAFE MODEL VIEW)
# SQLAdmin'in _handle_form_data hatasını düzelten ana sınıf.
# Tüm Admin modelleri bundan türetilecek.
# ==========================================




from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from starlette.datastructures import UploadFile
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import engine, get_db
import random
import models
import os
import signals 
from wtforms import TextAreaField, FileField, Field
from wtforms.widgets import FileInput
import uuid
import shutil

# --- ROUTERLARI ÇAĞIR ---
from routers import auth, webtoon, episode, comments, favorites, likes, novel, admin as admin_router

# 1. Tabloları oluştur 
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# ==========================================
# 🚨 MIDDLEWARE AYARLARI
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY", "cok-gizli-anahtar-123")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"📥 REQUEST: {request.method} {request.url}")
    auth_header = request.headers.get("Authorization")
    if auth_header:
        print(f"   🔑 Auth Header: {auth_header[:15]}...")
    else:
        print("   ⚠️ No Authorization Header found!")
    
    response = await call_next(request)
    print(f"📤 RESPONSE: {response.status_code}")
    return response

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
# 🛠️ ÖZEL ARAÇLAR (HATA ÖNLEYİCİLER)
# ==========================================

class NonCrasherFileField(Field):
    """
    SQLAdmin'in bozuk dosya işleme mantığından (AttributeError) 
    ve WTForms'un otomatik Length validator hatasından (TypeError) kaçmak için.
    Bu alan 'isinstance(x, FileField)' testinden geçmez ama 'Dosya Seç' butonunu render eder.
    """
    widget = FileInput()
    def _value(self):
        return "" # Dosya seçim kutusunda string yolu gösterme

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
        models.Webtoon.title, 
        models.Webtoon.categories, 
        models.Webtoon.is_featured, 
        models.Webtoon.is_published,
        models.Webtoon.view_count, 
        models.Webtoon.status
    ]

    form_ajax_refs = {
        "categories": {
            "fields": ("name",),
            "order_by": "name",
        }
    }

    form_overrides = {
        "cover_image": NonCrasherFileField,
        "banner_image": NonCrasherFileField,
    }

    form_columns = [
        "title",
        "slug",
        "summary",
        "categories",
        "status",
        "type",
        "is_featured",
        "is_published",
        "cover_image",
        "banner_image",
        "source_url"
    ]



    async def on_model_change(self, data, model, is_created, request):
        print("⚡ GHOST HUNTER (WEBTOON) ÇALIŞTI...") 
        
        UPLOAD_DIR_COVERS = "static/covers"
        os.makedirs(UPLOAD_DIR_COVERS, exist_ok=True)
        UPLOAD_DIR_BANNERS = "static/banners"
        os.makedirs(UPLOAD_DIR_BANNERS, exist_ok=True)

        for field in ["cover_image", "banner_image"]:
            val = data.get(field)
            
            # Sadece gerçekten yeni bir dosya yüklendiyse (ve boş değilse)
            if isinstance(val, UploadFile) and val.filename and val.size > 0:
                print(f"   📂 YENİ DOSYA YAKALANDI: {field}")
                
                # Eskisini sil
                if not is_created and getattr(model, field):
                    signals.delete_file(getattr(model, field))

                file_ext = val.filename.split(".")[-1]
                folder = UPLOAD_DIR_COVERS if field == "cover_image" else UPLOAD_DIR_BANNERS
                prefix = "banner-" if field == "banner_image" else ""
                new_filename = f"{prefix}{uuid.uuid4()}.{file_ext}"
                file_path = os.path.join(folder, new_filename).replace("\\", "/")
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(val.file, buffer)
                
                data[field] = file_path
            else:
                # Dosya gelmediyse veya boşsa, mevcut olanı koru (veritabanını ezme)
                print(f"   ℹ️ {field} değişmedi veya boş bırakıldı. Mevcut değer korunuyor.")
                if field in data:
                    del data[field]
                
        print("⚡ VERİTABANINA TEMİZ PAKET GİDİYOR...")
        return await super().on_model_change(data, model, is_created, request)

    column_formatters = {
        models.Webtoon.cover_image: lambda m, a: Markup(
            f'<img src="/{m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image and isinstance(m.cover_image, str) else "Yok",
        
        models.Webtoon.is_featured: lambda m, a: Markup(
            '<span style="color:#f1c40f; font-weight:bold;">★</span>' 
            if m.is_featured else '-'
        ),

        models.Webtoon.categories: lambda m, a: ", ".join([str(getattr(c, 'name', '-')) for c in m.categories if c]) if m.categories else "-"
    }

class EpisodeAdmin(ModelView, model=models.WebtoonEpisode):
    name = "Webtoon Bölümü"
    name_plural = "Webtoon Bölümleri"
    icon = "fa-solid fa-file-video"
    
    column_list = [
        models.WebtoonEpisode.id, 
        models.WebtoonEpisode.webtoon, 
        models.WebtoonEpisode.episode_number, 
        models.WebtoonEpisode.title,
        models.WebtoonEpisode.is_published
    ]
    list_per_page = 20

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
    
    column_formatters = {
        models.User.is_active: lambda m, a: Markup(
            '<span style="color:white; background-color:#2ecc71; padding:2px 8px; border-radius:4px;">AKTİF</span>' 
            if m.is_active else '<span style="color:white; background-color:#e74c3c; padding:2px 8px; border-radius:4px;">BANLI 🚫</span>'
        ),
        models.User.role: lambda m, a: Markup(
            f'<span style="color:white; background-color:{"#d63939" if m.role == "admin" else "#4299e1"}; padding:2px 8px; border-radius:4px;">{str(m.role).upper() if m.role else "USER"}</span>'
        )
    }

class CategoryAdmin(ModelView, model=models.Category):
    name = "Kategori"
    name_plural = "Kategoriler"
    icon = "fa-solid fa-list"
    column_list = [models.Category.id, models.Category.name]
    column_searchable_list = [models.Category.name] 

class CommentAdmin(ModelView, model=models.Comment):
    name = "Yorum"
    name_plural = "Yorumlar"
    icon = "fa-solid fa-comments"
    column_list = [models.Comment.id, models.Comment.user, models.Comment.content, models.Comment.created_at]

# 📖 ROMAN (NOVEL) YÖNETİMİ
class NovelAdmin(ModelView, model=models.Novel):
    name = "Roman"
    name_plural = "Romanlar"
    icon = "fa-solid fa-book-open"
    
    column_list = [
        models.Novel.id, 
        models.Novel.cover_image, 
        models.Novel.banner_image, 
        models.Novel.title, 
        models.Novel.author, 
        models.Novel.status,
        models.Novel.source_url,
        models.Novel.is_featured,
        models.Novel.is_published
    ]

    form_overrides = {
        "cover_image": NonCrasherFileField,
        "banner_image": NonCrasherFileField,
    }

    form_columns = [
        "title",
        "slug",
        "author",
        "summary",
        "status",
        "is_featured",
        "is_published",
        "cover_image",
        "banner_image",
        "source_url"
    ]



    async def on_model_change(self, data, model, is_created, request):
        print("⚡ GHOST HUNTER (NOVEL) ÇALIŞTI...") 
        
        UPLOAD_DIR_COVERS = "static/covers"
        os.makedirs(UPLOAD_DIR_COVERS, exist_ok=True)
        UPLOAD_DIR_BANNERS = "static/banners"
        os.makedirs(UPLOAD_DIR_BANNERS, exist_ok=True)

        for field in ["cover_image", "banner_image"]:
            val = data.get(field)
            
            if isinstance(val, UploadFile) and val.filename and val.size > 0:
                print(f"   📂 YENİ DOSYA YAKALANDI (NOVEL): {field}")
                
                # Eskisini sil
                if not is_created and getattr(model, field):
                    signals.delete_file(getattr(model, field))

                file_ext = val.filename.split(".")[-1]
                folder = UPLOAD_DIR_COVERS if field == "cover_image" else UPLOAD_DIR_BANNERS
                prefix = "novel-" if field == "cover_image" else "novel-banner-"
                new_filename = f"{prefix}{uuid.uuid4()}.{file_ext}"
                file_path = os.path.join(folder, new_filename).replace("\\", "/")
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(val.file, buffer)
                
                data[field] = file_path
            else:
                # Dosya gelmediyse mevcut olanı koru
                print(f"   ℹ️ (NOVEL) {field} değişmedi veya boş bırakıldı.")
                if field in data:
                    del data[field]
                
        print("⚡ VERİTABANINA TEMİZ PAKET GİDİYOR...")
        return await super().on_model_change(data, model, is_created, request)

    column_formatters = {
        models.Novel.cover_image: lambda m, a: Markup(
            f'<img src="/{m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image and isinstance(m.cover_image, str) else "Yok",

        models.Novel.banner_image: lambda m, a: Markup(
            f'<img src="/{m.banner_image}" width="100" height="40" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.banner_image and isinstance(m.banner_image, str) else "-",
        
        models.Novel.status: lambda m, a: Markup(
            f'<span style="color:white; background-color:{"#27ae60" if m.status == "ongoing" else "#e67e22"}; padding:2px 8px; border-radius:4px; font-size:12px;">{str(m.status).upper() if m.status else "ONGOING"}</span>'
        ),

        models.Novel.is_featured: lambda m, a: Markup(
            '<span style="color:#f1c40f; font-weight:bold;">★</span>'
            if m.is_featured else '-'
        ),

        models.Novel.source_url: lambda m, a: Markup(
            f'<a href="{m.source_url}" target="_blank" style="color:#3498db; text-decoration:none;">Link</a>'
        ) if m.source_url and isinstance(m.source_url, str) else "-"
    }

class NovelChapterAdmin(ModelView, model=models.NovelChapter):
    name = "Roman Bölümü"
    name_plural = "Roman Bölümleri"
    icon = "fa-solid fa-file-word"
    
    column_list = [
        models.NovelChapter.novel, 
        models.NovelChapter.chapter_number, 
        models.NovelChapter.title,
        models.NovelChapter.is_published
    ]

    form_overrides = {
        "content": TextAreaField
    }

    form_columns = [
        "novel",
        "chapter_number",
        "title",
        "content"
    ]

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
admin.add_view(EpisodeImageAdmin) 
admin.add_view(CategoryAdmin)
admin.add_view(CommentAdmin)
admin.add_view(NovelAdmin)       
admin.add_view(NovelChapterAdmin) 


# Routerları Dahil Et
app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router)
app.include_router(favorites.router)
app.include_router(likes.router)
app.include_router(novel.router)
app.include_router(admin_router.router)

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon & Novel API Hazır! 🚀"}

@app.get("/vitrin")
def get_vitrin(db: Session = Depends(get_db)):
    try:
        featured_webtoons = db.query(models.Webtoon).filter(models.Webtoon.is_featured == True).all()
        featured_novels = db.query(models.Novel).filter(models.Novel.is_featured == True).all()
    except Exception:
        return []

    vitrin_listesi = []

    for w in featured_webtoons:
        vitrin_listesi.append({
            "id": w.id, "title": w.title, "slug": w.slug,
            "banner_image": w.banner_image, "cover_image": w.cover_image,
            "summary": w.summary, "view_count": w.view_count,
            "status": w.status, "type": "webtoon", "typeLabel": "WEBTOON", "bg_color": "blue"
        })

    for n in featured_novels:
        vitrin_listesi.append({
            "id": n.id, "title": n.title, "slug": n.slug,
            "banner_image": n.cover_image, "cover_image": n.cover_image,
            "summary": n.summary, "view_count": 0,
            "status": n.status or "ongoing", "type": "novel", "typeLabel": "NOVEL", "bg_color": "purple"
        })

    random.shuffle(vitrin_listesi)
    return vitrin_listesi