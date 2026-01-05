from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
import os

# --- ROUTERLARI ÇAĞIR ---
# DİKKAT: Dosya adın 'comments.py' olduğu için sadece 'comments' kullanıyoruz.
# 'comment' (tekil) olanı sildim çünkü öyle bir dosyan yok.
from routers import auth, webtoon, episode, comments, favorites, likes

# Tabloları oluştur
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Ayarları (React ile iletişim için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- RESİM KLASÖRÜ AYARI ---
if not os.path.exists("static/covers"):
    os.makedirs("static/covers")
if not os.path.exists("static/images"):
    os.makedirs("static/images")

# Static dosyaları dışarı aç
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- DEPARTMANLARI SİSTEME BAĞLA ---
app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router)   # ✅ comments.py dosyasını bağladık
app.include_router(favorites.router)  # ⚠️ favorites.py dosyan yoksa burası hata verir!
app.include_router(likes.router)      # ⚠️ likes.py dosyan yoksa burası hata verir!

# NOT: 'app.include_router(comment.router)' satırını sildim çünkü yukarıda 'comments' var.

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon API Çalışıyor! 🚀"}