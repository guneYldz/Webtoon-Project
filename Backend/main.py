from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
import os

# --- ROUTERLARI TEK SEFERDE ÇAĞIR ---
# (Eski kodunda 3 kere çağırılmıştı, tek satırda topladık)
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

# --- RESİM KLASÖRÜ AYARI (DÜZELTİLEN KISIM) ---
# Eğer klasör yoksa hata vermesin, otomatik oluştursun.
# Senin yapında 'covers' ve 'images' olabilir diye ikisini de garantiye aldık.
if not os.path.exists("static/covers"):
    os.makedirs("static/covers")
if not os.path.exists("static/images"):
    os.makedirs("static/images")

# Buradaki "directory='static'" kodu, main.py ile AYNI klasördeki static klasörüne bakar.
# Sen klasörü içeri taşıdığın için bu kod şu an DOĞRU.
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- DEPARTMANLARI SİSTEME BAĞLA ---
app.include_router(webtoon.router)
app.include_router(episode.router)
app.include_router(auth.router)
app.include_router(comments.router) 
app.include_router(favorites.router)
app.include_router(likes.router)

@app.get("/")
def ana_sayfa():
    return {"durum": "Sistem Hazır", "mesaj": "Webtoon API Çalışıyor! 🚀"}