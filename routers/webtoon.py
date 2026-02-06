from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import shutil
import os
import uuid # Resim isimleri çakışmasın diye rastgele isim üretici

# Proje dosyalarından gerekli parçaları çağırıyoruz
from Backend.database import get_db
import models 
from schemas import WebtoonCard, WebtoonDetail
# Admin kontrolünü içeri aktarıyoruz
from routers.auth import get_current_admin

# Router kurulumu
router = APIRouter(
    prefix="/webtoons",    # Tüm adresler /webtoons ile başlar
    tags=["Webtoons"]      # Dokümantasyonda başlık
)

# 1. ANASAYFA LİSTELEME (Sadece Kart Bilgileri) - HERKESE AÇIK
@router.get("/", response_model=List[WebtoonCard]) 
def webtoonlari_getir(
    db: Session = Depends(get_db),
    limit: int = 10,       
    skip: int = 0,         
    sort_by: str = "newest" 
):
    query = db.query(models.Webtoon)

    if sort_by == "newest":
        query = query.order_by(desc(models.Webtoon.created_at))
    elif sort_by == "alphabetical":
        query = query.order_by(models.Webtoon.title.asc())

    webtoons = query.offset(skip).limit(limit).all()
    return webtoons

# 2. DETAY GÖSTERME (Bölümlerle Birlikte) - HERKESE AÇIK
@router.get("/{webtoon_id}", response_model=WebtoonDetail)
def webtoon_detay(webtoon_id: int, db: Session = Depends(get_db)):
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    
    return webtoon

# 3. WEBTOON EKLE (Resim Yüklemeli & Admin Korumalı) - KİLİTLİ 🔒
@router.post("/ekle", status_code=status.HTTP_201_CREATED)
def webtoon_ekle(
    baslik: str = Form(...),      # Form(...) veriyi form-data olarak alır
    ozet: str = Form(...),
    resim: UploadFile = File(...), # Dosya yükleme alanı
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin) # <-- Sadece Adminler!
):
    # 1. Klasör Kontrolü (Yoksa oluştur)
    klasor_yolu = "static/covers"
    if not os.path.exists(klasor_yolu):
        os.makedirs(klasor_yolu)

    # 2. Dosya Adını Güvenli Hale Getir (Çakışmayı önle)
    # Örn: 'resim.jpg' -> 'a1b2-c3d4...jpg' olur
    dosya_uzantisi = resim.filename.split(".")[-1]
    yeni_dosya_adi = f"{uuid.uuid4()}.{dosya_uzantisi}"
    kayit_yolu = f"{klasor_yolu}/{yeni_dosya_adi}"

    # 3. Dosyayı Diske Kaydet
    with open(kayit_yolu, "wb") as buffer:
        shutil.copyfileobj(resim.file, buffer)

    # 4. Veritabanına Kaydet (Resmin yolunu kaydediyoruz)
    yeni = models.Webtoon(
        title=baslik, 
        summary=ozet, 
        cover_image=kayit_yolu, # DB'ye dosya yolu yazılır: static/covers/...
        status="ongoing"
    )
    
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    
    return {
        "mesaj": "Webtoon Başarıyla Eklendi", 
        "id": yeni.id, 
        "ad": yeni.title,
        "kapak_resmi": kayit_yolu
    }