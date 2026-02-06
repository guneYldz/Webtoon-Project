from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routers import auth,webtoon,episode
from Backend.database import engine
from routers import webtoon, episode, auth, comments,favorites
from routers import likes
import models
import os

# Departmanları (Routerları) çağırıyoruz
from routers import webtoon, episode

# Tabloları oluştur
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resim Klasörü Ayarı
if not os.path.exists("static/images"):
    os.makedirs("static/images")

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
    return {"durum": "Sistem Hazır", "mesaj": "Router Yapısına Geçildi! "}