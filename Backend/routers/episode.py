from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid
import datetime

import models
import schemas
from database import get_db
from routers.auth import get_current_admin

router = APIRouter(
    prefix="/episodes", 
    tags=["Episodes (Bölümler)"]
)

# ==========================================
# 🚀 1. GELİŞMİŞ BÖLÜM VE RESİM YÜKLEME SİSTEMİ
# ==========================================
@router.post("/ekle", status_code=status.HTTP_201_CREATED)
def create_episode(
    webtoon_id: int = Form(...),
    title: str = Form(...),
    episode_number: float = Form(...),
    content_text: str = Form(None), 
    
    # 👇 ÇOKLU DOSYA SEÇİMİ
    resimler: List[UploadFile] = File(default=[]), 
    
    db: Session = Depends(get_db),
    # 👇 GÜVENLİK: Sadece Adminler ekleyebilir
    current_admin: models.User = Depends(get_current_admin) 
):
    # A. Webtoon Var mı Kontrolü
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

    # B. Aynı Bölüm Numarası Var mı?
    var_mi = db.query(models.WebtoonEpisode).filter(
        models.WebtoonEpisode.webtoon_id == webtoon_id,
        models.WebtoonEpisode.episode_number == episode_number
    ).first()
    
    if var_mi:
        raise HTTPException(status_code=400, detail="Bu bölüm numarası zaten var!")

    # C. Bölümü Veritabanına Kaydet
    yeni_bolum = models.WebtoonEpisode(
        webtoon_id=webtoon_id,
        title=title,
        episode_number=episode_number,
        content_text=content_text,
        view_count=0
    )
    db.add(yeni_bolum)
    
    # Webtoon'un tarihini güncelle (Anasayfada üste çıksın)
    webtoon.created_at = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(yeni_bolum) # ID oluştu

    # D. Eğer Resim Varsa Yükle (MANGA Modu) 🖼️
    if resimler:
        klasor_yolu = f"static/images/{webtoon_id}/{yeni_bolum.id}"
        if not os.path.exists(klasor_yolu):
            os.makedirs(klasor_yolu)

        resimler.sort(key=lambda x: x.filename)

        for index, resim in enumerate(resimler):
            if not resim.filename:
                continue

            uzanti = resim.filename.split(".")[-1]
            yeni_ad = f"page_{index+1}_{uuid.uuid4().hex[:8]}.{uzanti}"
            kayit_yolu = f"{klasor_yolu}/{yeni_ad}"

            with open(kayit_yolu, "wb") as buffer:
                shutil.copyfileobj(resim.file, buffer)

            # Veritabanına kaydet
            db_img = models.EpisodeImage(
                episode_id=yeni_bolum.id,
                image_url=kayit_yolu,
                page_order=index + 1
            )
            db.add(db_img)
        
        db.commit()

    return {
        "mesaj": "Bölüm Başarıyla Eklendi", 
        "bolum_id": yeni_bolum.id, 
        "resim_sayisi": len(resimler) if resimler else 0,
        "tur": "NOVEL" if content_text else "MANGA"
    }


# ==========================================
# 📖 2. BÖLÜM OKUMA (HİBRİT SİSTEM: BOT + DB)
# ==========================================
@router.get("/{episode_id}")
def bolum_oku(episode_id: int, request: Request, db: Session = Depends(get_db)):
    
    # 1. Bölümü Bul
    bolum = db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.id == episode_id).first()
    
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    
    # --- GÜNCELLENEN KISIM: NULL (Boş) Değer Kontrolü ---
    # İzlenme sayısı NULL ise 0 yap, değilse 1 artır
    if bolum.view_count is None:
        bolum.view_count = 0
    bolum.view_count += 1 
    
    # Seri (Webtoon) izlenmesini de artır
    if bolum.webtoon:
        if bolum.webtoon.view_count is None:
            bolum.webtoon.view_count = 0
        bolum.webtoon.view_count += 1
        
    db.commit()
    # ----------------------------------------------------

    # 3. Navigasyon
    sonraki_bolum = db.query(models.WebtoonEpisode).filter(
        models.WebtoonEpisode.webtoon_id == bolum.webtoon_id,
        models.WebtoonEpisode.episode_number > bolum.episode_number
    ).order_by(models.WebtoonEpisode.episode_number.asc()).first()

    onceki_bolum = db.query(models.WebtoonEpisode).filter(
        models.WebtoonEpisode.webtoon_id == bolum.webtoon_id,
        models.WebtoonEpisode.episode_number < bolum.episode_number
    ).order_by(models.WebtoonEpisode.episode_number.desc()).first()

    # --- 4. RESİM LİSTESİ OLUŞTURMA ---
    image_urls = []

    # YÖNTEM A: Veritabanından Çek (Admin panelinden yüklenenler)
    db_images = db.query(models.EpisodeImage)\
                  .filter(models.EpisodeImage.episode_id == episode_id)\
                  .order_by(models.EpisodeImage.page_order)\
                  .all()

    if db_images:
        for img in db_images:
            # Resim yolu "static/..." ise başına domain ekle
            full_url = str(request.base_url) + img.image_url
            image_urls.append(full_url)
    
    # YÖNTEM B: Klasörden Çek (Bot tarafından indirilenler)
    # Eğer DB boşsa ve bir Webtoon'a bağlıysa klasörü kontrol et
    if not image_urls and bolum.webtoon:
        slug = bolum.webtoon.slug
        chap_num = str(int(bolum.episode_number)) if bolum.episode_number % 1 == 0 else str(bolum.episode_number)
        
        # Botun indirdiği yol: static/images/{slug}/bolum-{num}
        bot_folder_path = f"static/images/{slug}/bolum-{chap_num}"
        
        if os.path.exists(bot_folder_path):
            files = os.listdir(bot_folder_path)
            try:
                # Dosya isimlerini sayısal olarak sıralamaya çalış (sahne-1, sahne-2...)
                files.sort(key=lambda x: int(x.split('sahne-')[1].split('.')[0]))
            except:
                files.sort()

            for file in files:
                if file.endswith((".webp", ".jpg", ".png", ".jpeg")):
                    url = f"{str(request.base_url)}static/images/{slug}/bolum-{chap_num}/{file}"
                    image_urls.append(url)

    # 5. Yanıtı Döndür
    return {
        "id": bolum.id,
        "webtoon_id": bolum.webtoon_id,
        "webtoon_title": bolum.webtoon.title if bolum.webtoon else "Bilinmiyor",
        "webtoon_slug": bolum.webtoon.slug if bolum.webtoon else "",
        "webtoon_cover": f"{request.base_url}{bolum.webtoon.cover_image}" if bolum.webtoon and bolum.webtoon.cover_image else None,
        
        "title": bolum.title,
        "episode_number": bolum.episode_number,
        "created_at": bolum.created_at,
        "view_count": bolum.view_count,
        "content_text": bolum.content_text,
        "images": image_urls, # URL Listesi
        "next_episode_id": sonraki_bolum.id if sonraki_bolum else None,
        "prev_episode_id": onceki_bolum.id if onceki_bolum else None
    }