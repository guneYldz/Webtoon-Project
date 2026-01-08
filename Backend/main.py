from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from markupsafe import Markup
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import engine
import models
import os

# --- GEREKLİ KÜTÜPHANELER ---
import shutil
import uuid
from wtforms import FileField
from wtforms.validators import Optional

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
# 🛠️ ADMIN MODELLERİ (COVER: BUTON, BANNER: YAZI)
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
        models.Webtoon.is_featured, 
        models.Webtoon.view_count, 
        models.Webtoon.status
    ]

    # 👇 SADECE 'COVER' İÇİN BUTON KOYUYORUZ
    # Banner'ı buraya yazmadığımız için otomatik olarak YAZI KUTUSU (Text) oluyor.
    form_overrides = {
        "cover_image": FileField
    }

    # 👇 Hata vermemesi için ikisini de opsiyonel yapıyoruz
    form_args = {
        "cover_image": {"validators": [Optional()]},
        "banner_image": {"validators": [Optional()]} 
    }

    # 👇 KAYDETME MANTIĞI
    async def on_model_change(self, data, model, is_created, request):
        
        # Dosya Kaydetme Yardımcısı
        def save_file(file_obj, folder_name):
            # Dosya kontrolü (isim var mı, dosya mı?)
            if not file_obj or not hasattr(file_obj, "filename") or not file_obj.filename:
                return None
            
            ext = file_obj.filename.split(".")[-1]
            new_filename = f"{uuid.uuid4()}.{ext}"
            
            if not os.path.exists(f"static/{folder_name}"):
                os.makedirs(f"static/{folder_name}")

            file_path = f"static/{folder_name}/{new_filename}"
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file_obj.file, buffer)
                
            return file_path

        # --- SADECE KAPAK RESMİ İŞLEMİ ---
        # Banner'a karışmıyoruz, çünkü o zaten metin olarak geliyor ve sqladmin onu kendi kaydediyor.
        if "cover_image" in data:
            saved_path = save_file(data["cover_image"], "covers")
            if saved_path:
                # Yeni dosya seçildiyse yolunu kaydet
                data["cover_image"] = saved_path
            else:
                # Dosya seçilmediyse veriden sil (Eski resim kalsın diye)
                del data["cover_image"]

    # Resim Önizlemeleri
    column_formatters = {
        models.Webtoon.cover_image: lambda m, a: Markup(
            f'<img src="/{m.cover_image}" width="50" height="75" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.cover_image else "Yok",
        
        models.Webtoon.banner_image: lambda m, a: Markup(
            f'<img src="/{m.banner_image}" width="120" height="40" style="border-radius:4px; object-fit:cover; border:1px solid #ccc;">'
        ) if m.banner_image else '<span style="color:#999; font-size:10px;">Yüklenmedi</span>',

        models.Webtoon.is_featured: lambda m, a: Markup(
            '<span style="color:#f1c40f; font-weight:bold;">★ VİTRİN</span>' 
            if m.is_featured else '<span style="color:#bdc3c7;">-</span>'
        )
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

# ==========================================
# 🚀 BAŞLATMA
# ==========================================

if not os.path.exists("static/covers"): os.makedirs("static/covers")
if not os.path.exists("static/banners"): os.makedirs("static/banners")
if not os.path.exists("static/images"): os.makedirs("static/images")

app.mount("/static", StaticFiles(directory="static"), name="static")

admin = Admin(app, engine, authentication_backend=authentication_backend)
admin.add_view(UserAdmin)
admin.add_view(WebtoonAdmin)
admin.add_view(EpisodeAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(CommentAdmin)

app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router)
app.include_router(favorites.router)
app.include_router(likes.router)

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon API Hazır! 🚀"}