from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import shutil
import os
import uuid # Resim isimleri çakışmasın diye rastgele isim üretici

# Proje dosyalarından gerekli parçaları çağırıyoruz
from database import get_db
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
    baslik: str = Form(...),
    ozet: str = Form(...),
    # 👇 Kapak resmi (Zorunlu)
    resim: UploadFile = File(...), 
    # 👇 Banner resmi (İsteğe bağlı - None olabilir)
    banner: UploadFile = File(None), 
    
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    # --- 1. Klasörleri Hazırla ---
    # Kapaklar için:
    kapak_klasoru = "static/covers"
    if not os.path.exists(kapak_klasoru):
        os.makedirs(kapak_klasoru)
        
    # Bannerlar için:
    banner_klasoru = "static/banners"
    if not os.path.exists(banner_klasoru):
        os.makedirs(banner_klasoru)

    # --- 2. Kapak Resmini Kaydet ---
    dosya_uzantisi = resim.filename.split(".")[-1]
    yeni_dosya_adi = f"{uuid.uuid4()}.{dosya_uzantisi}"
    kapak_yolu = f"{kapak_klasoru}/{yeni_dosya_adi}"

    with open(kapak_yolu, "wb") as buffer:
        shutil.copyfileobj(resim.file, buffer)

    # --- 3. Banner Resmini Kaydet (Eğer yüklendiyse) ---
    banner_yolu = None # Varsayılan olarak boş
    
    if banner:
        banner_uzantisi = banner.filename.split(".")[-1]
        yeni_banner_adi = f"{uuid.uuid4()}.{banner_uzantisi}"
        banner_yolu = f"{banner_klasoru}/{yeni_banner_adi}"
        
        with open(banner_yolu, "wb") as buffer:
            shutil.copyfileobj(banner.file, buffer)

    # --- 4. Veritabanına Kayıt ---
    yeni = models.Webtoon(
        title=baslik, 
        summary=ozet, 
        cover_image=kapak_yolu, 
        banner_image=banner_yolu, # 👇 Yeni eklediğimiz alan
        status="ongoing"
    )
    
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    
    return {
        "mesaj": "Webtoon Başarıyla Eklendi", 
        "id": yeni.id, 
        "ad": yeni.title,
        "kapak": kapak_yolu,
        "banner": banner_yolu
    }