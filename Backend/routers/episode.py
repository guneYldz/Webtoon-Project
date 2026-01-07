from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
from typing import List
import shutil
import os

from database import get_db
import models
import schemas 

# Router Ayarları
router = APIRouter(
    prefix="/episodes",
    tags=["Bölümler & Resim Yükleme"]
)

# 1. BÖLÜM EKLEME (Bot Burayı Kullanıyor)
@router.post("/", status_code=status.HTTP_201_CREATED)
def bolum_ekle(episode: schemas.EpisodeCreate, db: Session = Depends(get_db)):
    # Webtoon var mı kontrol et
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == episode.webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

    # Aynı bölüm numarası var mı?
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
        episode_number=episode.episode_number,
        view_count=0,
        # ✅ YENİ: Eğer bu bir NOVEL ise metni de kaydet
        content_text=episode.content_text 
    )
    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum)
    return {"mesaj": "Bölüm Başarıyla Oluşturuldu", "id": yeni_bolum.id}


# 2. TOPLU RESİM YÜKLEME
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

    # Klasör Yolu: static/images/{webtoon_id}/{episode_id}/
    klasor_yolu = f"static/images/{bolum.webtoon_id}/{episode_id}"
    
    if not os.path.exists(klasor_yolu):
        os.makedirs(klasor_yolu) # Klasör yoksa oluştur

    # Mevcut resim sayısını al (Sıralamayı bozmamak için)
    mevcut_sayi = db.query(models.EpisodeImage).filter(models.EpisodeImage.episode_id == episode_id).count()
    
    yuklenenler = []

    for i, dosya in enumerate(dosyalar):
        sira = mevcut_sayi + i + 1
        
        # Dosya adını güvenli hale getir
        uzanti = dosya.filename.split(".")[-1]
        yeni_ad = f"page_{sira}.{uzanti}" 
        dosya_yolu = f"{klasor_yolu}/{yeni_ad}"

        # Dosyayı fiziksel olarak kaydet
        with open(dosya_yolu, "wb") as buffer:
            shutil.copyfileobj(dosya.file, buffer)

        # Veritabanına kaydet
        db_resim = models.EpisodeImage(
            episode_id=episode_id, 
            image_url=dosya_yolu, 
            page_order=sira
        )
        db.add(db_resim)
        yuklenenler.append(dosya_yolu)

    db.commit()
    return {"mesaj": f"{len(dosyalar)} resim başarıyla yüklendi!", "dosyalar": yuklenenler}


# 3. BÖLÜM OKUMA (Frontend Burayı Kullanıyor)
# ✅ YENİ: response_model ekledik, böylece Pydantic şemayı zorunlu kılıyoruz.
@router.get("/{episode_id}/read", response_model=schemas.EpisodeDetailSchema)
def bolum_oku(episode_id: int, db: Session = Depends(get_db)):
    # Mevcut bölümü bul
    bolum = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    
    # İzlenme sayısını artır
    if bolum.view_count is None: bolum.view_count = 0
    bolum.view_count += 1   
    
    if bolum.webtoon and bolum.webtoon.view_count is None:
         bolum.webtoon.view_count = 0
    if bolum.webtoon:
        bolum.webtoon.view_count += 1

    db.commit()

    # --- ÖNCEKİ ve SONRAKİ Bölümü Bul ---
    sonraki_bolum = db.query(models.Episode).filter(
        models.Episode.webtoon_id == bolum.webtoon_id,
        models.Episode.episode_number > bolum.episode_number
    ).order_by(models.Episode.episode_number.asc()).first()

    onceki_bolum = db.query(models.Episode).filter(
        models.Episode.webtoon_id == bolum.webtoon_id,
        models.Episode.episode_number < bolum.episode_number
    ).order_by(models.Episode.episode_number.desc()).first()

    # Resimleri çek (Eğer varsa)
    resimler = db.query(models.EpisodeImage)\
                  .filter(models.EpisodeImage.episode_id == episode_id)\
                  .order_by(models.EpisodeImage.page_order)\
                  .all()

    # ✅ YENİ: Veriyi Şemaya Uygun Paketle (Metin Dahil)
    return schemas.EpisodeDetailSchema(
        id=bolum.id,
        webtoon_id=bolum.webtoon_id,
        webtoon_title=bolum.webtoon.title if bolum.webtoon else "Bilinmiyor",
        title=bolum.title,
        episode_title=bolum.title,
        episode_number=bolum.episode_number,
        views=bolum.view_count,
        created_at=bolum.created_at,
        
        # 📖 İşte sihirli dokunuş:
        content_text=bolum.content_text, 
        
        images=resimler,
        next_episode_id=sonraki_bolum.id if sonraki_bolum else None,
        prev_episode_id=onceki_bolum.id if onceki_bolum else None
    )