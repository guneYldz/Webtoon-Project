from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid
import models, schemas, database
from routers import auth  # Yetki kontrolü buradan geliyor

router = APIRouter(prefix="/episodes", tags=["Episodes"])

# ==========================================
# 🚀 1. GELİŞMİŞ BÖLÜM VE RESİM YÜKLEME SİSTEMİ
# ==========================================
# Bu fonksiyon:
# 1. Bölüm kaydını oluşturur (Webtoon veya Novel).
# 2. Eğer resim seçildiyse hepsini sırayla yükler.
# 3. Sadece ADMIN veya EDITOR yetkisi olanlar kullanabilir.

@router.post("/ekle", status_code=status.HTTP_201_CREATED)
def create_episode(
    webtoon_id: int = Form(...),
    title: str = Form(...),
    episode_number: float = Form(...),
    content_text: str = Form(None), # Novel ise metin buraya gelir
    
    # 👇 ÇOKLU DOSYA SEÇİMİ (List[UploadFile])
    resimler: List[UploadFile] = File(default=[]), 
    
    db: Session = Depends(database.get_db),
    
    # 👇 GÜVENLİK: Sadece yetkililer girebilir!
    current_user: models.User = Depends(auth.get_current_editor) 
):
    # A. Webtoon Var mı Kontrolü
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

    # B. Aynı Bölüm Numarası Var mı?
    var_mi = db.query(models.Episode).filter(
        models.Episode.webtoon_id == webtoon_id,
        models.Episode.episode_number == episode_number
    ).first()
    if var_mi:
        raise HTTPException(status_code=400, detail="Bu bölüm numarası zaten var!")

    # C. Bölümü Veritabanına Kaydet
    yeni_bolum = models.Episode(
        webtoon_id=webtoon_id,
        title=title,
        episode_number=episode_number,
        content_text=content_text,
        view_count=0
    )
    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum) # ID oluştu (Örn: 15)

    # D. Eğer Resim Varsa Yükle (MANGA Modu) 🖼️
    if resimler:
        # Klasör: static/images/{webtoon_id}/{bolum_id}/
        klasor_yolu = f"static/images/{webtoon_id}/{yeni_bolum.id}"
        if not os.path.exists(klasor_yolu):
            os.makedirs(klasor_yolu)

        # Resimleri isme göre sırala (1.jpg, 2.jpg karışmasın diye)
        # Not: Yükleyen kişi dosya adlarını düzgün vermeli (01.jpg, 02.jpg)
        resimler.sort(key=lambda x: x.filename)

        yuklenen_sayisi = 0
        for index, resim in enumerate(resimler):
            # Boş dosya geldiyse atla (Bazen form boş veri yollayabilir)
            if not resim.filename:
                continue

            # Dosya adını güvenli yap ama sırasını koru
            uzanti = resim.filename.split(".")[-1]
            # page_1_rastgele.jpg formatında kaydet
            yeni_ad = f"page_{index+1}_{uuid.uuid4().hex[:8]}.{uzanti}"
            kayit_yolu = f"{klasor_yolu}/{yeni_ad}"

            # Diske yaz
            with open(kayit_yolu, "wb") as buffer:
                shutil.copyfileobj(resim.file, buffer)

            # Veritabanına "Sıra Numarası" ile kaydet
            db_img = models.EpisodeImage(
                episode_id=yeni_bolum.id,
                image_url=kayit_yolu,
                page_order=index + 1
            )
            db.add(db_img)
            yuklenen_sayisi += 1
        
        db.commit()

    return {
        "mesaj": "Bölüm Başarıyla Eklendi", 
        "bolum_id": yeni_bolum.id, 
        "resim_sayisi": len(resimler) if resimler else 0,
        "tur": "NOVEL" if content_text else "MANGA"
    }


# ==========================================
# 📖 2. BÖLÜM OKUMA (FRONTEND İÇİN) - HERKESE AÇIK
# ==========================================
@router.get("/{episode_id}/read", response_model=schemas.EpisodeDetailSchema)
def bolum_oku(episode_id: int, db: Session = Depends(database.get_db)):
    # Bölümü Bul
    bolum = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    
    # İzlenmeyi Artır
    if bolum.view_count is None: bolum.view_count = 0
    bolum.view_count += 1   
    
    if bolum.webtoon:
        if bolum.webtoon.view_count is None: bolum.webtoon.view_count = 0
        bolum.webtoon.view_count += 1

    db.commit()

    # Önceki ve Sonraki Bölümü Bul (Navigasyon Butonları İçin)
    sonraki_bolum = db.query(models.Episode).filter(
        models.Episode.webtoon_id == bolum.webtoon_id,
        models.Episode.episode_number > bolum.episode_number
    ).order_by(models.Episode.episode_number.asc()).first()

    onceki_bolum = db.query(models.Episode).filter(
        models.Episode.webtoon_id == bolum.webtoon_id,
        models.Episode.episode_number < bolum.episode_number
    ).order_by(models.Episode.episode_number.desc()).first()

    # Resimleri Çek (Varsa)
    resimler = db.query(models.EpisodeImage)\
                  .filter(models.EpisodeImage.episode_id == episode_id)\
                  .order_by(models.EpisodeImage.page_order)\
                  .all()

    # Paketi Hazırla ve Gönder
    return schemas.EpisodeDetailSchema(
        id=bolum.id,
        webtoon_id=bolum.webtoon_id,
        webtoon_title=bolum.webtoon.title if bolum.webtoon else "Bilinmiyor",
        title=bolum.title,
        episode_title=bolum.title,
        episode_number=bolum.episode_number,
        views=bolum.view_count,
        created_at=bolum.created_at,
        
        # İçerik (Novel metni veya Manga resimleri)
        content_text=bolum.content_text, 
        images=resimler,
        
        # İleri/Geri Linkleri
        next_episode_id=sonraki_bolum.id if sonraki_bolum else None,
        prev_episode_id=onceki_bolum.id if onceki_bolum else None
    )