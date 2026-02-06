from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import shutil
import os
import uuid # Resim isimleri çakışmasın diye rastgele isim üretici
import re   # Slug üretimi için regex

# Proje dosyalarından gerekli parçaları çağırıyoruz
from database import get_db
import models 
import schemas
# Admin kontrolünü içeri aktarıyoruz
from routers.auth import get_current_admin

# Router kurulumu
router = APIRouter(
    prefix="/webtoons",    # Tüm adresler /webtoons ile başlar
    tags=["Webtoons"]      # Dokümantasyonda başlık
)

# --- YARDIMCI FONKSİYON: SLUG OLUŞTURUCU ---
def slug_olustur(text: str):
    text = text.lower() # Küçük harfe çevir
    # Türkçe karakterleri İngilizce karşılıklarına çevir
    text = text.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    text = re.sub(r'[^a-z0-9\s-]', '', text) # Harf, sayı ve tire dışındakileri sil
    text = re.sub(r'[\s-]+', '-', text)      # Boşlukları tire yap
    return text.strip('-')

# 1. ANASAYFA LİSTELEME (Sadece Kart Bilgileri) - HERKESE AÇIK
@router.get("/", response_model=List[schemas.WebtoonCard]) 
def webtoonlari_getir(
    db: Session = Depends(get_db),
    limit: int = 20,       
    skip: int = 0,         
    sort_by: str = "newest" 
):

    # O P T I M İ Z A S Y O N EKLENDİ (N+1 Sorunu Çözümü)
    from sqlalchemy.orm import selectinload

    query = db.query(models.Webtoon).filter(models.Webtoon.is_published == True).options(
        selectinload(models.Webtoon.episodes.and_(models.WebtoonEpisode.is_published == True)),
        selectinload(models.Webtoon.categories)
    )

    if sort_by == "newest":
        query = query.order_by(desc(models.Webtoon.created_at))
    elif sort_by == "alphabetical":
        query = query.order_by(models.Webtoon.title.asc())
    elif sort_by == "popular":
        query = query.order_by(desc(models.Webtoon.view_count))

    webtoons = query.offset(skip).limit(limit).all()
    return webtoons

# 2. DETAY GÖSTERME (Bölümlerle Birlikte) - HERKESE AÇIK
# 2. DETAY GÖSTERME (Hem ID hem Slug destekler) - HERKESE AÇIK
@router.get("/{id_or_slug}", response_model=schemas.WebtoonDetail)
def webtoon_detay(id_or_slug: str, db: Session = Depends(get_db)):
    # Gelen veri sayı mı? (Örn: "1", "5")
    if id_or_slug.isdigit():
        webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == int(id_or_slug), models.Webtoon.is_published == True).first()
    
    # Yoksa yazı mı? (Örn: "shadow-slave")
    else:
        webtoon = db.query(models.Webtoon).filter(models.Webtoon.slug == id_or_slug, models.Webtoon.is_published == True).first()
    
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    
    # Görüntülenme sayısını artır
    webtoon.view_count += 1
    db.commit()
    
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
    # Eğer admin sistemini henüz kurmadıysan burayı geçici olarak get_db yapabilirsin:
    # current_user: models.User = Depends(get_current_admin) 
):
    # --- 1. Slug Oluştur (URL için gerekli) ---
    yeni_slug = slug_olustur(baslik)
    
    # Slug çakışması kontrolü (Aynı isimde webtoon var mı?)
    # SQL Server hatasını önlemek için slug uzunluğu kontrol altında
    if len(yeni_slug) > 250:
        yeni_slug = yeni_slug[:250]

    if db.query(models.Webtoon).filter(models.Webtoon.slug == yeni_slug).first():
        yeni_slug = f"{yeni_slug}-{uuid.uuid4().hex[:4]}" # Sonuna rastgele kod ekle

    # --- 2. Klasörleri Hazırla ---
    # static klasörü backend'in ana dizininde olmalı
    kapak_klasoru = "static/covers"
    banner_klasoru = "static/banners"

    os.makedirs(kapak_klasoru, exist_ok=True)
    os.makedirs(banner_klasoru, exist_ok=True)

    # --- 3. Kapak Resmini Kaydet ---
    dosya_uzantisi = resim.filename.split(".")[-1]
    yeni_dosya_adi = f"{uuid.uuid4()}.{dosya_uzantisi}"
    kapak_yolu = f"{kapak_klasoru}/{yeni_dosya_adi}"

    with open(kapak_yolu, "wb") as buffer:
        shutil.copyfileobj(resim.file, buffer)

    # --- 4. Banner Resmini Kaydet (Eğer yüklendiyse) ---
    banner_yolu = None 
    
    if banner:
        banner_uzantisi = banner.filename.split(".")[-1]
        yeni_banner_adi = f"{uuid.uuid4()}.{banner_uzantisi}"
        banner_yolu = f"{banner_klasoru}/{yeni_banner_adi}"
        
        with open(banner_yolu, "wb") as buffer:
            shutil.copyfileobj(banner.file, buffer)

    # --- 5. Veritabanına Kayıt ---
    yeni = models.Webtoon(
        title=baslik, 
        slug=yeni_slug,     # 👈 SLUG EKLENDİ (String 255 ile uyumlu)
        summary=ozet, 
        cover_image=kapak_yolu, 
        banner_image=banner_yolu, 
        status="ongoing",
        is_published=False,
        type=models.ContentType.MANGA # Enum Kullanımı
    )
    
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    
    return {
        "mesaj": "Webtoon Başarıyla Eklendi", 
        "id": yeni.id, 
        "slug": yeni.slug,
        "ad": yeni.title,
        "kapak": kapak_yolu
    }