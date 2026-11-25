from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, File, UploadFile, Form, Query, status, Response, Request
from sqlalchemy.orm import Session, selectinload, defer
from sqlalchemy import desc, func
from typing import List
import os
import uuid # Resim isimleri çakışmasın diye rastgele isim üretici
import re   # Slug üretimi için regex

# Proje dosyalarından gerekli parçaları çağırıyoruz
from database import get_db
import models 
import schemas
# Admin kontrolünü içeri aktarıyoruz
from routers.auth import get_current_admin
from utils.media import validate_and_save_image
from utils.query_helpers import parse_pg_int
from utils.view_tracker import schedule_view_increment

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

def _get_webtoons_logic(db: Session, limit: int, skip: int, sort_by: str):
    query = db.query(models.Webtoon).filter(models.Webtoon.is_published == True).options(
        selectinload(models.Webtoon.episodes.and_(models.WebtoonEpisode.is_published == True)).defer(
            models.WebtoonEpisode.content_text
        ),
        selectinload(models.Webtoon.categories)
    )

    if sort_by == "newest":
        query = query.order_by(desc(models.Webtoon.created_at))
    elif sort_by == "alphabetical":
        query = query.order_by(models.Webtoon.title.asc())
    elif sort_by == "popular":
        query = query.order_by(desc(models.Webtoon.view_count))

    return query.offset(skip).limit(limit).all()


# 1. ANASAYFA LİSTELEME (Sadece Kart Bilgileri) - HERKESE AÇIK
@router.get("/", response_model=List[schemas.WebtoonCard]) 
def webtoonlari_getir(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
    sort_by: str = "newest" 
):
    return _get_webtoons_logic(db, limit, skip, sort_by)


@router.get("", include_in_schema=False, response_model=List[schemas.WebtoonCard])
def webtoonlari_getir_no_slash(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
    sort_by: str = "newest",
):
    return _get_webtoons_logic(db, limit, skip, sort_by)

# 2. DETAY GÖSTERME (Hem ID hem Slug destekler) - HERKESE AÇIK
@router.get("/{id_or_slug}", response_model=schemas.WebtoonDetail)
def webtoon_detay(
    id_or_slug: str,
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    clean_key = (id_or_slug or "").strip()
    load_opts = (
        selectinload(models.Webtoon.episodes.and_(models.WebtoonEpisode.is_published == True)).defer(
            models.WebtoonEpisode.content_text
        ),
        selectinload(models.Webtoon.categories),
    )
    if clean_key.isdigit():
        parsed_id = parse_pg_int(clean_key)
        if parsed_id is None:
            raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
        webtoon = db.query(models.Webtoon).options(*load_opts).filter(models.Webtoon.id == parsed_id, models.Webtoon.is_published == True).first()
    else:
        webtoon = db.query(models.Webtoon).options(*load_opts).filter(models.Webtoon.slug == clean_key, models.Webtoon.is_published == True).first()
        if not webtoon and clean_key:
            webtoon = db.query(models.Webtoon).options(*load_opts).filter(
                func.trim(func.lower(models.Webtoon.slug)) == clean_key.lower(),
                models.Webtoon.is_published == True,
            ).first()
    
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")

    detail = schemas.WebtoonDetail.model_validate(webtoon)

    if schedule_view_increment(background_tasks, request, "webtoon", webtoon.id):
        detail.view_count = (detail.view_count or 0) + 1

    return detail

# 3. WEBTOON EKLE (Resim Yüklemeli & Admin Korumalı) - KİLİTLİ 🔒
@router.post("/ekle", status_code=status.HTTP_201_CREATED)
def webtoon_ekle(
    baslik: str = Form(...),
    ozet: str = Form(...),
    resim: UploadFile = File(...), 
    banner: UploadFile = File(None), 
    source_url: str = Form(None),
    series_type: str = Form("WEBTOON"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    # --- 1. Slug Oluştur ---
    yeni_slug = slug_olustur(baslik)
    if len(yeni_slug) > 250:
        yeni_slug = yeni_slug[:250]

    if db.query(models.Webtoon).filter(models.Webtoon.slug == yeni_slug).first():
        yeni_slug = f"{yeni_slug}-{uuid.uuid4().hex[:4]}"

    # --- 2. Kapak ve Banner Resmini Doğrula ve Kaydet ---
    kapak_klasoru = "static/covers"
    banner_klasoru = "static/banners"

    kapak_yolu = validate_and_save_image(resim, kapak_klasoru, max_bytes=15 * 1024 * 1024)

    banner_yolu = None
    if banner and banner.filename:
        try:
            banner_yolu = validate_and_save_image(banner, banner_klasoru, max_bytes=15 * 1024 * 1024, prefix="banner-")
        except Exception:
            if kapak_yolu and os.path.exists(kapak_yolu):
                try:
                    os.remove(kapak_yolu)
                except OSError:
                    pass
            raise

    # --- 3. Veritabanına Kayıt ---
    yeni = models.Webtoon(
        title=baslik, 
        slug=yeni_slug,
        summary=ozet, 
        cover_image=kapak_yolu, 
        banner_image=banner_yolu, 
        status="ongoing",
        is_published=False,
        type=models.ContentType.MANGA if str(series_type).upper() == "MANGA" else models.ContentType.WEBTOON,
        source_url=source_url
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