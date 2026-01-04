from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import shutil
import os
import uuid # Rastgele isim oluşturmak için

from database import get_db
import models

# Router Ayarları
router = APIRouter(
    prefix="/episodes",
    tags=["Bölümler & Resim Yükleme"]
)

# --- GİRİŞ ŞEMASI (Veri Kalıbı) ---
class EpisodeCreate(BaseModel):
    webtoon_id: int
    title: str          # Örn: "Bölüm 1: Başlangıç"
    episode_number: int # Örn: 1 (Sayı olmalı)

# 1. BÖLÜM EKLEME
@router.post("/", status_code=status.HTTP_201_CREATED)
def bolum_ekle(episode: EpisodeCreate, db: Session = Depends(get_db)):
    # Webtoon var mı kontrol et
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == episode.webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

    # Aynı bölüm numarası var mı? (Örn: 1. bölüm zaten varsa tekrar ekleme)
    var_mi = db.query(models.Episode).filter(
        models.Episode.webtoon_id == episode.webtoon_id,
        models.Episode.episode_number == episode.episode_number
    ).first()
    
    if var_mi:
        raise HTTPException(status_code=400, detail="Bu bölüm numarası zaten var!")

    # Kaydet
    yeni_bolum = models.Episode(
        webtoon_id=episode.webtoon_id, 
        title=episode.title, 
        episode_number=episode.episode_number
    )
    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum)
    return {"mesaj": "Bölüm Başarıyla Oluşturuldu", "id": yeni_bolum.id}


# 2. TOPLU RESİM YÜKLEME (Senin kodunun geliştirilmiş hali)
@router.post("/{episode_id}/upload-images")
def resim_yukle(
    episode_id: int, 
    dosyalar: List[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    # Bölüm kontrolü
    bolum = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı!")

    # Mevcut resim sayısını al (Sıralamayı bozmamak için)
    mevcut_sayi = db.query(models.EpisodeImage).filter(models.EpisodeImage.episode_id == episode_id).count()
    baslangic = mevcut_sayi + 1
    
    # Klasör Yolu: static/images/{webtoon_id}/{episode_id}/
    # Bu sayede her bölümün resmi kendi klasöründe durur, karışmaz.
    klasor_yolu = f"static/images/{bolum.webtoon_id}/{episode_id}"
    
    if not os.path.exists(klasor_yolu):
        os.makedirs(klasor_yolu) # Klasör yoksa oluştur

    yuklenenler = []

    for i, dosya in enumerate(dosyalar):
        sira = baslangic + i
        
        # Dosya adını güvenli hale getiriyoruz (Türkçe karakter sorununu önler)
        uzanti = dosya.filename.split(".")[-1]
        yeni_ad = f"page_{sira}.{uzanti}" 
        dosya_yolu = f"{klasor_yolu}/{yeni_ad}"

        # Dosyayı fiziksel olarak kaydet
        with open(dosya_yolu, "wb") as buffer:
            shutil.copyfileobj(dosya.file, buffer)

        # Veritabanına kaydet
        # Not: Frontend'in erişmesi için başındaki 'static/' kısmını veritabanına yazarken 
        # nasıl kullanacağına göre ayarlayabilirsin. Şimdilik tam yol yazıyoruz.
        db_resim = models.EpisodeImage(
            episode_id=episode_id, 
            image_url=dosya_yolu, # Örn: static/images/1/5/page_1.jpg
            page_order=sira
        )
        db.add(db_resim)
        yuklenenler.append(dosya_yolu)

    db.commit()
    return {"mesaj": f"{len(dosyalar)} resim başarıyla yüklendi!", "dosyalar": yuklenenler}


# 3. BÖLÜM OKUMA (Frontend Resimleri Buradan Çekecek)
@router.get("/{episode_id}/read")
def bolum_oku(episode_id: int, db: Session = Depends(get_db)):
    # Bölümü bul
    bolum = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    
    # --- YENİ EKLENEN KISIM: wiew_count Artır ---
    # Eğer veritabanında değer boşsa (None) hata vermesin diye önce 0 yapıyoruz
    if bolum.wiew_count is None:
        bolum.wiew_count = 0

    bolum.wiew_count += 1  # Senin verdiğin isimle güncelledik
    db.commit()            # Veritabanına kaydettik
    # -------------------------------------------------------

    # Bağlı olduğu webtoon'u bul (Başlık için)
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == bolum.webtoon_id).first()

    # Resimleri sayfa sırasına göre (page_order) getir
    resimler = db.query(models.EpisodeImage)\
                  .filter(models.EpisodeImage.episode_id == episode_id)\
                  .order_by(models.EpisodeImage.page_order)\
                  .all()

    # Basit bir sözlük (dictionary) döndürüyoruz
    return {
        "webtoon_title": webtoon.title,
        "episode_title": bolum.title,
        "episode_number": bolum.episode_number,
        "views": bolum.wiew_count,  # Frontend'e gönderirken de güncel sayıyı gönderiyoruz
        "images": resimler 
    }