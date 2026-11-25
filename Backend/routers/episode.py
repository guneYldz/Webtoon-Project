from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import datetime
from fastapi import Response
import models
import schemas
from database import get_db
from routers.auth import get_current_admin
from utils.chapter_title import clean_chapter_number, default_chapter_title, chapter_display_label
from utils.cache import invalidate_admin_stats_cache, invalidate_content_caches
from utils.media import validate_and_save_image
from utils.view_tracker import schedule_view_increment


# --- YARDIMCI: DOĞAL SIRALAMA (1, 2, 10 SORUNU İÇİN) ---
import re
def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

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
    title: str = Form(""),
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

    title = default_chapter_title(title, episode_number)

    # C. Bölümü Veritabanına Ekle (flush ile atomik ID al)
    yeni_bolum = models.WebtoonEpisode(
        webtoon_id=webtoon_id,
        title=title,
        episode_number=episode_number,
        content_text=content_text,
        is_published=True,
        view_count=0
    )
    db.add(yeni_bolum)
    db.flush()

    saved_count = 0
    # D. Eğer Resim Varsa Doğrula ve Yükle (MANGA Modu) 🖼️
    if resimler:
        klasor_yolu = f"static/images/{webtoon_id}/{yeni_bolum.id}"
        try:
            resimler.sort(key=lambda x: natural_sort_key(x.filename or ""))
        except Exception:
            resimler.sort(key=lambda x: x.filename or "")

        try:
            for index, resim in enumerate(resimler):
                if not resim.filename:
                    continue

                kayit_yolu = validate_and_save_image(
                    resim,
                    klasor_yolu,
                    max_bytes=15 * 1024 * 1024,
                    prefix=f"page_{index + 1}_",
                    max_width=1920,
                )
                saved_count += 1

                db_img = models.EpisodeImage(
                    episode_id=yeni_bolum.id,
                    image_url=kayit_yolu,
                    page_order=saved_count
                )
                db.add(db_img)
        except Exception:
            db.rollback()
            shutil.rmtree(klasor_yolu, ignore_errors=True)
            raise

    # Webtoon'un tarihini güncelle (Anasayfada üste çıksın)
    webtoon.created_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(yeni_bolum)
    invalidate_content_caches()

    # Favorisinde bu webtoon olanlara bildirim
    try:
        from routers.notifications import notify_favorite_users_new_chapter
        ch_label = chapter_display_label(title, episode_number)
        notify_favorite_users_new_chapter(
            db,
            webtoon_id=webtoon.id,
            series_title=webtoon.title,
            chapter_label=ch_label,
            link=f"/webtoon/{webtoon.slug or webtoon.id}/bolum/{yeni_bolum.id}",
        )
        db.commit()
    except Exception:
        pass

    return {
        "mesaj": "Bölüm Başarıyla Eklendi", 
        "bolum_id": yeni_bolum.id, 
        "resim_sayisi": saved_count,
        "tur": "NOVEL" if content_text else "MANGA"
    }


# ==========================================
# 📖 2. BÖLÜM OKUMA (HİBRİT SİSTEM: BOT + DB)
# ==========================================
@router.get("/{episode_id}")
def bolum_oku(
    episode_id: int,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # 1. Bölümü Bul
    bolum = db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.id == episode_id, models.WebtoonEpisode.is_published == True).first()
    
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    current_views = bolum.view_count or 0
    if schedule_view_increment(
        background_tasks,
        request,
        "episode",
        episode_id,
        webtoon_id=bolum.webtoon_id,
    ):
        current_views += 1

    # 3. Navigasyon (Önceki/Sonraki Bölüm — sadece id okunur)
    sonraki_bolum_id = db.query(models.WebtoonEpisode.id).filter(
        models.WebtoonEpisode.webtoon_id == bolum.webtoon_id,
        models.WebtoonEpisode.episode_number > bolum.episode_number,
        models.WebtoonEpisode.is_published == True
    ).order_by(models.WebtoonEpisode.episode_number.asc()).limit(1).scalar()

    onceki_bolum_id = db.query(models.WebtoonEpisode.id).filter(
        models.WebtoonEpisode.webtoon_id == bolum.webtoon_id,
        models.WebtoonEpisode.episode_number < bolum.episode_number,
        models.WebtoonEpisode.is_published == True
    ).order_by(models.WebtoonEpisode.episode_number.desc()).limit(1).scalar()

    # 4. Resim Listesi Oluşturma (Göreli static/... URL'leri)
    image_urls = []
    
    # YÖNTEM A: Veritabanı
    db_images = db.query(models.EpisodeImage)\
                  .filter(models.EpisodeImage.episode_id == episode_id)\
                  .order_by(models.EpisodeImage.page_order)\
                  .all()

    if db_images:
        for img in db_images:
            rel_url = (img.image_url or "").replace("\\", "/").lstrip("/")
            if rel_url:
                image_urls.append(rel_url)
    
    # YÖNTEM B: Klasör (Bot)
    if not image_urls and bolum.webtoon:
        slug = bolum.webtoon.slug
        bot_base_path = f"static/images/{slug}"
        if not slug or not os.path.exists(bot_base_path):
            text_slug = bolum.webtoon.title.lower()
            text_slug = text_slug.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
            text_slug = re.sub(r'[^a-z0-9\s-]', '', text_slug)
            slug = re.sub(r'[\s-]+', '-', text_slug).strip('-')

        chap_num = str(int(bolum.episode_number)) if bolum.episode_number % 1 == 0 else str(bolum.episode_number)
        bot_folder_path = f"static/images/{slug}/bolum-{chap_num}"
        
        if os.path.exists(bot_folder_path):
            files = os.listdir(bot_folder_path)
            try:
                files.sort(key=natural_sort_key)
            except Exception:
                files.sort()

            for file in files:
                if file.endswith((".webp", ".jpg", ".png", ".jpeg")):
                    image_urls.append(f"static/images/{slug}/bolum-{chap_num}/{file}")

    cover_rel = (
        bolum.webtoon.cover_image.replace("\\", "/").lstrip("/")
        if bolum.webtoon and bolum.webtoon.cover_image
        else None
    )

    return {
        "id": bolum.id,
        "webtoon_id": bolum.webtoon_id,
        "webtoon_title": bolum.webtoon.title if bolum.webtoon else "Bilinmiyor",
        "webtoon_slug": bolum.webtoon.slug if bolum.webtoon else "",
        "webtoon_cover": cover_rel,
        "series_type": (
            getattr(bolum.webtoon.type, "value", bolum.webtoon.type)
            if bolum.webtoon and getattr(bolum.webtoon, "type", None)
            else "WEBTOON"
        ),
        "title": bolum.title,
        "episode_number": clean_chapter_number(bolum.episode_number),
        "created_at": bolum.created_at,
        "view_count": current_views,
        "content_text": bolum.content_text,
        "images": image_urls,
        "next_episode_id": sonraki_bolum_id,
        "prev_episode_id": onceki_bolum_id
    }


@router.delete("/{episode_id}")
def bolum_sil(
    episode_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    bolum = db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.id == episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    webtoon_id = bolum.webtoon_id
    slug = bolum.webtoon.slug if bolum.webtoon else None
    ep_num = bolum.episode_number
    title = bolum.title

    db.query(models.Comment).filter(
        models.Comment.webtoon_episode_id == episode_id,
        models.Comment.parent_id.isnot(None),
    ).delete(synchronize_session=False)
    db.query(models.Comment).filter(models.Comment.webtoon_episode_id == episode_id).delete(synchronize_session=False)
    db.query(models.Like).filter(models.Like.episode_id == episode_id).delete(synchronize_session=False)
    db.query(models.ChapterReaction).filter(
        models.ChapterReaction.content_type == "webtoon",
        models.ChapterReaction.target_id == episode_id,
    ).delete(synchronize_session=False)

    db.delete(bolum)
    db.commit()
    invalidate_admin_stats_cache()

    klasor = f"static/images/{webtoon_id}/{episode_id}"
    if os.path.isdir(klasor):
        shutil.rmtree(klasor, ignore_errors=True)

    if slug and ep_num is not None:
        chap_num = str(int(ep_num)) if float(ep_num).is_integer() else str(ep_num)
        bot_folder = f"static/images/{slug}/bolum-{chap_num}"
        if os.path.isdir(bot_folder):
            shutil.rmtree(bot_folder, ignore_errors=True)

    return {"status": "success", "message": f"'{title}' silindi"}

