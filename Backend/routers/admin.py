from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, or_, func
from database import get_db 
from datetime import datetime, timezone
import html
import logging
import models 
import schemas
import os
import re
import urllib.parse
import uuid
from typing import Optional, List
from routers.auth import get_current_admin, get_current_editor  # ADMIN / EDITOR AUTH
from fastapi.encoders import jsonable_encoder
from utils.cache import (
    admin_stats_cache,
    invalidate_admin_stats_cache,
    invalidate_content_caches,
)
import utils.media as media_utils
from utils.media import delete_static_file_safe, validate_and_save_image

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin",
    tags=["Admin Paneli"]
)

UPLOAD_DIR = "static/covers"
UPLOAD_DIR_BANNERS = "static/banners"
UPLOAD_DIR_ANNOUNCEMENTS = "static/announcements"
ALLOWED_ROLES = {"user", "editor", "admin"}

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR_BANNERS, exist_ok=True)
os.makedirs(UPLOAD_DIR_ANNOUNCEMENTS, exist_ok=True)


def _validate_announcement_link(link: Optional[str]) -> Optional[str]:
    if link is None:
        return None
    cleaned = link.strip()
    if not cleaned:
        return None
    if (cleaned.startswith("/") and not cleaned.startswith("//")) or cleaned.startswith(("http://", "https://")):
        return cleaned
    raise HTTPException(
        status_code=400,
        detail="Duyuru bağlantısı '/', 'http://' veya 'https://' ile başlamalıdır.",
    )


def _slugify_title(title: str) -> str:
    text = (title or "").strip().lower()
    text = text.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text).strip("-")
    return text or "seri"


def parse_category_ids(raw: Optional[str]) -> Optional[List[int]]:
    """Form'dan '1,2,3' gelir. None = alanı değiştirme."""
    if raw is None:
        return None
    raw = raw.strip()
    if not raw:
        return []
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    return ids


def set_item_categories(db: Session, item, category_ids: List[int]):
    if not category_ids:
        item.categories = []
        return
    cats = db.query(models.Category).filter(models.Category.id.in_(category_ids)).all()
    item.categories = cats


def parse_comic_type(raw: Optional[str]):
    """Form'dan WEBTOON / MANGA. Geçersizse WEBTOON."""
    if not raw:
        return models.ContentType.WEBTOON
    val = str(raw).strip().upper()
    if val == "MANGA":
        return models.ContentType.MANGA
    return models.ContentType.WEBTOON


def with_categories(obj):
    data = jsonable_encoder(obj)
    for key in ("categories", "category_links", "webtoon_links", "novel_links", "chapters", "episodes", "favorites"):
        data.pop(key, None)
    data["categories"] = [{"id": c.id, "name": c.name} for c in (getattr(obj, "categories", None) or [])]
    data["translation_glossary"] = getattr(obj, "translation_glossary", None)
    t = getattr(obj, "type", None)
    if t is not None:
        data["type"] = getattr(t, "value", t)
    return data


async def _extract_series_update_data(request: Request) -> tuple[dict, Optional[UploadFile], Optional[UploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Geçersiz JSON gövdesi")
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="JSON gövdesi nesne olmalıdır")
        return payload, None, None

    if "application/x-www-form-urlencoded" in content_type:
        raw_body = (await request.body()).decode("utf-8")
        return {k: v for k, v in urllib.parse.parse_qsl(raw_body, keep_blank_values=True)}, None, None

    form = await request.form()
    fields: dict = {}
    cover_file = None
    banner_file = None
    for key, val in form.multi_items():
        if key == "cover_image" and hasattr(val, "filename"):
            if val.filename:
                cover_file = val
        elif key == "banner_image" and hasattr(val, "filename"):
            if val.filename:
                banner_file = val
        else:
            fields[key] = val
    return fields, cover_file, banner_file


def _normalize_optional_text(value) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip() or None


def _coerce_optional_bool(value) -> Optional[bool]:
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in ("true", "1", "yes", "evet"):
        return True
    if text in ("false", "0", "no", "hayir", "hayır"):
        return False
    return None


def _apply_common_series_fields(series, fields: dict) -> Optional[str]:
    if "title" in fields and fields["title"] is not None:
        series.title = str(fields["title"])
    if "summary" in fields and fields["summary"] is not None:
        series.summary = str(fields["summary"])
    if "status" in fields and fields["status"] is not None:
        series.status = str(fields["status"])
    if "is_published" in fields:
        parsed_pub = _coerce_optional_bool(fields["is_published"])
        if parsed_pub is not None:
            series.is_published = parsed_pub
    if "is_featured" in fields:
        parsed_feat = _coerce_optional_bool(fields["is_featured"])
        if parsed_feat is not None:
            series.is_featured = parsed_feat
    if "source_url" in fields:
        series.source_url = _normalize_optional_text(fields["source_url"])
    if "translation_glossary" in fields:
        series.translation_glossary = _normalize_optional_text(fields["translation_glossary"])

    if "category_ids" in fields and fields["category_ids"] is not None:
        cat_val = fields["category_ids"]
        if isinstance(cat_val, list):
            return ",".join(str(x) for x in cat_val)
        return str(cat_val)
    return None


# ==================== SLIM OPTIONS (DROPDOWNS) ====================

@router.get("/options/webtoons")
async def get_webtoon_options(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_editor),
):
    rows = (
        db.query(
            models.Webtoon.id,
            models.Webtoon.title,
            models.Webtoon.slug,
            models.Webtoon.type,
            models.Webtoon.is_published,
        )
        .order_by(models.Webtoon.id.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "title": row.title,
            "slug": row.slug,
            "type": getattr(row.type, "value", row.type) or "WEBTOON",
            "is_published": bool(row.is_published),
        }
        for row in rows
    ]


@router.get("/options/novels")
async def get_novel_options(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_editor),
):
    rows = (
        db.query(
            models.Novel.id,
            models.Novel.title,
            models.Novel.slug,
            models.Novel.is_published,
        )
        .order_by(models.Novel.id.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "title": row.title,
            "slug": row.slug,
            "is_published": bool(row.is_published),
        }
        for row in rows
    ]


# ==================== WEBTOONS ====================

@router.post("/webtoon/create")
async def create_webtoon(
    title: str = Form(...),
    summary: str = Form(...),
    status: str = Form("ongoing"),
    is_published: bool = Form(False),
    is_featured: bool = Form(False),
    source_url: Optional[str] = Form(None),
    series_type: Optional[str] = Form("WEBTOON"),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    category_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cover_path = None
    banner_path = None

    try:
        if cover_image and cover_image.filename:
            cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024, "", True, 1200
            )

        if banner_image and banner_image.filename:
            banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-", True, 1920
            )

        base_slug = _slugify_title(title)
        random_suffix = str(uuid.uuid4())[:8]
        slug = f"{base_slug}-{random_suffix}"

        new_webtoon = models.Webtoon(
            title=title,
            slug=slug,
            summary=summary,
            status=status,
            is_published=is_published,
            is_featured=is_featured,
            source_url=source_url,
            cover_image=cover_path,
            banner_image=banner_path,
            type=parse_comic_type(series_type),
        )

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, new_webtoon, ids)

        db.add(new_webtoon)
        db.commit()
        db.refresh(new_webtoon)
        invalidate_content_caches()

        return {"status": "success", "message": "Webtoon başarıyla oluşturuldu!", "data": with_categories(new_webtoon)}

    except HTTPException:
        db.rollback()
        delete_static_file_safe(cover_path)
        delete_static_file_safe(banner_path)
        raise
    except Exception:
        db.rollback()
        delete_static_file_safe(cover_path)
        delete_static_file_safe(banner_path)
        logger.exception("Webtoon oluşturma hatası")
        raise HTTPException(status_code=500, detail="Webtoon oluşturulurken sunucu hatası oluştu.")


@router.get("/webtoons")
async def list_webtoons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None),
    is_featured: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    query = db.query(models.Webtoon)
    
    if search:
        query = query.filter(
            or_(
                models.Webtoon.title.ilike(f"%{search}%"),
                models.Webtoon.summary.ilike(f"%{search}%")
            )
        )
    
    if status:
        query = query.filter(models.Webtoon.status == status)
    if is_published is not None:
        query = query.filter(models.Webtoon.is_published == is_published)
    if is_featured is not None:
        query = query.filter(models.Webtoon.is_featured == is_featured)
    
    total = query.count()
    offset = (page - 1) * limit
    webtoons = query.order_by(models.Webtoon.created_at.desc()).offset(offset).limit(limit).all()
    
    try:
        encoded = jsonable_encoder(webtoons)
        for i, w in enumerate(webtoons):
            encoded[i]["type"] = getattr(w.type, "value", w.type) or "WEBTOON"
        data = encoded
    except Exception:
        data = webtoons
    return {
        "status": "success",
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/webtoon/list")
async def list_admin_webtoons(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    """Basit liste (User'ın istediği endpoint)"""
    webtoons = db.query(models.Webtoon).order_by(models.Webtoon.id.desc()).all()
    return webtoons


@router.get("/webtoons/{webtoon_id}")
async def get_webtoon(
    webtoon_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    webtoon = db.query(models.Webtoon).options(selectinload(models.Webtoon.categories)).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    return {"status": "success", "data": with_categories(webtoon)}


@router.put("/webtoons/{webtoon_id}")
async def update_webtoon(
    webtoon_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")

    fields, cover_image, banner_image = await _extract_series_update_data(request)
    category_ids = _apply_common_series_fields(webtoon, fields)
    if "series_type" in fields and fields["series_type"] is not None:
        webtoon.type = parse_comic_type(str(fields["series_type"]))

    new_cover_path = None
    new_banner_path = None
    old_cover_path = webtoon.cover_image
    old_banner_path = webtoon.banner_image

    try:
        if cover_image and cover_image.filename:
            new_cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024, "", True, 1200
            )
            webtoon.cover_image = new_cover_path

        if banner_image and banner_image.filename:
            new_banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-", True, 1920
            )
            webtoon.banner_image = new_banner_path

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, webtoon, ids)

        db.commit()
        db.refresh(webtoon)
        invalidate_content_caches()

        if new_cover_path and old_cover_path and old_cover_path != new_cover_path:
            delete_static_file_safe(old_cover_path)
        if new_banner_path and old_banner_path and old_banner_path != new_banner_path:
            delete_static_file_safe(old_banner_path)

        return {"status": "success", "message": "Webtoon güncellendi", "data": with_categories(webtoon)}
    except HTTPException:
        db.rollback()
        delete_static_file_safe(new_cover_path)
        delete_static_file_safe(new_banner_path)
        raise
    except Exception:
        db.rollback()
        delete_static_file_safe(new_cover_path)
        delete_static_file_safe(new_banner_path)
        logger.exception("Webtoon güncelleme hatası (id=%s)", webtoon_id)
        raise HTTPException(status_code=500, detail="Webtoon güncellenirken sunucu hatası oluştu.")


@router.delete("/webtoons/{webtoon_id}")
async def delete_webtoon(
    webtoon_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    
    try:
        db.delete(webtoon)
        db.commit()
        invalidate_content_caches()
        return {"status": "success", "message": f"'{webtoon.title}' silindi"}
    except Exception:
        db.rollback()
        logger.exception("Webtoon silme hatası (id=%s)", webtoon_id)
        raise HTTPException(status_code=500, detail="Webtoon silinirken sunucu hatası oluştu.")


# ==================== NOVELS ====================

@router.get("/novels")
async def list_novels(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None),
    is_featured: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    query = db.query(models.Novel)
    
    if search:
        query = query.filter(
            or_(
                models.Novel.title.ilike(f"%{search}%"),
                models.Novel.summary.ilike(f"%{search}%")
            )
        )
    
    if status:
        query = query.filter(models.Novel.status == status)
    if is_published is not None:
        query = query.filter(models.Novel.is_published == is_published)
    if is_featured is not None:
        query = query.filter(models.Novel.is_featured == is_featured)
    
    total = query.count()
    offset = (page - 1) * limit
    novels = query.order_by(models.Novel.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "status": "success",
        "data": novels,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }


@router.get("/novel/list")
async def list_admin_novels(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    """Basit liste (Webtoon sayfasındaki gibi)"""
    novels = db.query(models.Novel).order_by(models.Novel.id.desc()).all()
    return novels


@router.get("/novels/{novel_id}")
async def get_novel(
    novel_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    novel = db.query(models.Novel).options(selectinload(models.Novel.categories)).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel bulunamadı")
    return {"status": "success", "data": with_categories(novel)}


@router.post("/novels")
async def create_novel(
    title: str = Form(...),
    summary: str = Form(...),
    author: Optional[str] = Form(None),
    status: str = Form("ongoing"),
    is_published: bool = Form(False),
    is_featured: bool = Form(False),
    source_url: Optional[str] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    category_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cover_path = None
    banner_path = None

    try:
        if cover_image and cover_image.filename:
            cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024, "", True, 1200
            )

        if banner_image and banner_image.filename:
            banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-", True, 1920
            )

        base_slug = _slugify_title(title)
        random_suffix = str(uuid.uuid4())[:8]
        slug = f"{base_slug}-{random_suffix}"

        new_novel = models.Novel(
            title=title,
            slug=slug,
            summary=summary,
            author=author,
            status=status,
            is_published=is_published,
            is_featured=is_featured,
            source_url=source_url,
            cover_image=cover_path,
            banner_image=banner_path
        )

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, new_novel, ids)

        db.add(new_novel)
        db.commit()
        db.refresh(new_novel)
        invalidate_content_caches()
        return {"status": "success", "message": "Novel oluşturuldu", "data": with_categories(new_novel)}
    except HTTPException:
        db.rollback()
        delete_static_file_safe(cover_path)
        delete_static_file_safe(banner_path)
        raise
    except Exception:
        db.rollback()
        delete_static_file_safe(cover_path)
        delete_static_file_safe(banner_path)
        logger.exception("Novel oluşturma hatası")
        raise HTTPException(status_code=500, detail="Novel oluşturulurken sunucu hatası oluştu.")


@router.put("/novels/{novel_id}")
async def update_novel(
    novel_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    novel = db.query(models.Novel).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel bulunamadı")

    fields, cover_image, banner_image = await _extract_series_update_data(request)
    category_ids = _apply_common_series_fields(novel, fields)
    if "author" in fields:
        novel.author = _normalize_optional_text(fields["author"])

    new_cover_path = None
    new_banner_path = None
    old_cover_path = novel.cover_image
    old_banner_path = novel.banner_image

    try:
        if cover_image and cover_image.filename:
            new_cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024, "", True, 1200
            )
            novel.cover_image = new_cover_path

        if banner_image and banner_image.filename:
            new_banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-", True, 1920
            )
            novel.banner_image = new_banner_path

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, novel, ids)

        db.commit()
        db.refresh(novel)
        invalidate_content_caches()

        if new_cover_path and old_cover_path and old_cover_path != new_cover_path:
            delete_static_file_safe(old_cover_path)
        if new_banner_path and old_banner_path and old_banner_path != new_banner_path:
            delete_static_file_safe(old_banner_path)

        return {"status": "success", "message": "Novel güncellendi", "data": with_categories(novel)}
    except HTTPException:
        db.rollback()
        delete_static_file_safe(new_cover_path)
        delete_static_file_safe(new_banner_path)
        raise
    except Exception:
        db.rollback()
        delete_static_file_safe(new_cover_path)
        delete_static_file_safe(new_banner_path)
        logger.exception("Novel güncelleme hatası (id=%s)", novel_id)
        raise HTTPException(status_code=500, detail="Novel güncellenirken sunucu hatası oluştu.")


@router.delete("/novels/{novel_id}")
async def delete_novel(
    novel_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    novel = db.query(models.Novel).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel bulunamadı")
    
    try:
        db.delete(novel)
        db.commit()
        invalidate_content_caches()
        return {"status": "success", "message": f"'{novel.title}' silindi"}
    except Exception:
        db.rollback()
        logger.exception("Novel silme hatası (id=%s)", novel_id)
        raise HTTPException(status_code=500, detail="Novel silinirken sunucu hatası oluştu.")


# ==================== CATEGORIES ====================

@router.get("/categories")
async def list_categories(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    categories = db.query(models.Category).all()
    return {"status": "success", "data": categories}


@router.post("/categories")
async def create_category(
    name: str = Form(...), 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    try:
        new_cat = models.Category(name=name)
        db.add(new_cat)
        db.commit()
        db.refresh(new_cat)
        invalidate_content_caches()
        return {"status": "success", "message": "Kategori oluşturuldu", "data": new_cat}
    except Exception:
        db.rollback()
        logger.exception("Kategori oluşturma hatası")
        raise HTTPException(status_code=500, detail="Kategori oluşturulurken sunucu hatası oluştu.")


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int, 
    name: str = Form(...), 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    
    cat.name = name
    try:
        db.commit()
        invalidate_content_caches()
        return {"status": "success", "message": "Kategori güncellendi", "data": cat}
    except Exception:
        db.rollback()
        logger.exception("Kategori güncelleme hatası (id=%s)", category_id)
        raise HTTPException(status_code=500, detail="Kategori güncellenirken sunucu hatası oluştu.")


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    
    try:
        db.delete(cat)
        db.commit()
        invalidate_content_caches()
        return {"status": "success", "message": f"'{cat.name}' silindi"}
    except Exception:
        db.rollback()
        logger.exception("Kategori silme hatası (id=%s)", category_id)
        raise HTTPException(status_code=500, detail="Kategori silinirken sunucu hatası oluştu.")


# ==================== USERS ====================

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    query = db.query(models.User)
    
    if search:
        query = query.filter(
            or_(
                models.User.username.ilike(f"%{search}%"),
                models.User.email.ilike(f"%{search}%")
            )
        )
    
    if role:
        query = query.filter(models.User.role == role)
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    
    total = query.count()
    offset = (page - 1) * limit
    users = query.order_by(models.User.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "status": "success",
        "data": [schemas.UserOut.model_validate(u) for u in users],
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"status": "success", "data": schemas.UserOut.model_validate(user)}


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    role: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    if role is not None:
        clean_role = role.strip().lower()
        if clean_role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Geçersiz rol. Yalnızca 'user', 'editor' veya 'admin' olabilir.",
            )
        if user.id == current_admin.id and clean_role != "admin":
            raise HTTPException(
                status_code=400,
                detail="Kendi admin yetkinizi düşüremezsiniz.",
            )
        user.role = clean_role

    if is_active is not None:
        if user.id == current_admin.id and is_active is False:
            raise HTTPException(
                status_code=400,
                detail="Kendi hesabınızı devre dışı bırakamazsınız.",
            )
        user.is_active = is_active
        if is_active is False:
            from datetime import datetime, timezone
            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            user.token_version = (user.token_version or 1) + 1
            db.query(models.RefreshToken).filter(
                models.RefreshToken.user_id == user.id,
                models.RefreshToken.revoked_at.is_(None),
            ).update({"revoked_at": now_utc}, synchronize_session=False)
    
    try:
        db.commit()
        db.refresh(user)
        invalidate_admin_stats_cache()
        return {
            "status": "success",
            "message": "Kullanıcı güncellendi",
            "data": schemas.UserOut.model_validate(user),
        }
    except Exception:
        db.rollback()
        logger.exception("Kullanıcı güncelleme hatası (id=%s)", user_id)
        raise HTTPException(status_code=500, detail="Kullanıcı güncellenirken sunucu hatası oluştu.")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz.")
    
    try:
        db.delete(user)
        db.commit()
        invalidate_admin_stats_cache()
        return {"status": "success", "message": f"'{user.username}' silindi"}
    except Exception:
        db.rollback()
        logger.exception("Kullanıcı silme hatası (id=%s)", user_id)
        raise HTTPException(status_code=500, detail="Kullanıcı silinirken sunucu hatası oluştu.")


# ==================== DUYURULAR ====================

@router.post("/announcements")
async def create_announcement(
    title: str = Form(...),
    message: str = Form(...),
    link: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    """Admin duyurusu — duyuru kanalına kaydeder + tüm aktif kullanıcılara toplu SQL ile bildirim gönderir."""
    from routers.notifications import notify_all_active_users

    title = title.strip()
    message = message.strip()
    if not title or not message:
        raise HTTPException(status_code=400, detail="Başlık ve mesaj zorunlu")

    safe_link = _validate_announcement_link(link)

    image_path = None
    try:
        if image and image.filename:
            image_path = await run_in_threadpool(
                validate_and_save_image, image, UPLOAD_DIR_ANNOUNCEMENTS, 10 * 1024 * 1024, "", True, 1200
            )

        # 1) Duyuru kanalına kalıcı kayıt
        announcement = models.Announcement(
            title=title,
            message=message,
            link=safe_link,
            image=image_path,
            created_by=current_admin.id,
        )
        db.add(announcement)
        db.flush()  # id alsın

        duyuru_link = f"/duyurular#duyuru-{announcement.id}"

        # 2) Tüm aktif kullanıcılara tek toplu SQL INSERT ile bildirim
        count = notify_all_active_users(
            db,
            type_="announcement",
            title=title,
            message=message,
            link=duyuru_link,
        )

        db.commit()
        invalidate_admin_stats_cache()
        return {
            "status": "success",
            "message": f"Duyuru yayınlandı ve {count} kullanıcıya bildirildi",
            "sent_to": count,
            "announcement_id": announcement.id,
            "image": image_path,
        }
    except HTTPException:
        db.rollback()
        delete_static_file_safe(image_path)
        raise
    except Exception:
        db.rollback()
        delete_static_file_safe(image_path)
        logger.exception("Duyuru oluşturma hatası")
        raise HTTPException(status_code=500, detail="Duyuru yayınlanırken sunucu hatası oluştu.")


# ==================== YORUM PANELİ ====================

@router.get("/comments")
async def list_comments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    seri_type: Optional[str] = Query(None),  # "novel" | "webtoon"
    reported_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    from routers.comments import _seri_bilgisi, _COMMENT_LOAD_OPTIONS

    report_subq = (
        db.query(
            models.CommentReport.comment_id.label("comment_id"),
            func.count(models.CommentReport.id).label("report_count"),
        )
        .filter(models.CommentReport.status == "open")
        .group_by(models.CommentReport.comment_id)
        .subquery()
    )

    query = db.query(models.Comment)\
        .outerjoin(models.User, models.Comment.user_id == models.User.id)\
        .options(*_COMMENT_LOAD_OPTIONS)

    if reported_only:
        query = query.join(report_subq, report_subq.c.comment_id == models.Comment.id)
    else:
        query = query.outerjoin(report_subq, report_subq.c.comment_id == models.Comment.id)

    if search:
        query = query.filter(
            or_(
                models.Comment.content.ilike(f"%{search}%"),
                models.User.username.ilike(f"%{search}%")
            )
        )

    if seri_type == "novel":
        query = query.filter(
            or_(
                models.Comment.novel_chapter_id.isnot(None),
                models.Comment.novel_id.isnot(None),
            )
        )
    elif seri_type == "webtoon":
        query = query.filter(
            or_(
                models.Comment.webtoon_episode_id.isnot(None),
                models.Comment.webtoon_id.isnot(None),
            )
        )

    total = query.count()
    offset = (page - 1) * limit
    if reported_only:
        query = query.order_by(desc(report_subq.c.report_count), models.Comment.created_at.desc())
    else:
        query = query.order_by(models.Comment.created_at.desc())

    comments = query.offset(offset).limit(limit).all()

    comment_ids = [c.id for c in comments]
    report_count_map = {}
    latest_reason_map = {}
    if comment_ids:
        open_reports = (
            db.query(models.CommentReport)
            .filter(
                models.CommentReport.comment_id.in_(comment_ids),
                models.CommentReport.status == "open",
            )
            .order_by(models.CommentReport.created_at.desc(), models.CommentReport.id.desc())
            .all()
        )
        for rep in open_reports:
            cid = int(rep.comment_id)
            report_count_map[cid] = report_count_map.get(cid, 0) + 1
            if cid not in latest_reason_map:
                latest_reason_map[cid] = rep.reason

    data = []
    for c in comments:
        seri = _seri_bilgisi(c)
        seri_title = seri.get("seri_title")
        bolum_title = seri.get("bolum_title")
        target_label = (
            f"{seri_title} — {bolum_title}"
            if seri_title and bolum_title
            else (seri_title or bolum_title)
        )
        data.append({
            "id": c.id,
            "username": c.user.username if c.user else "Silinmiş Kullanıcı",
            "user_id": c.user_id,
            "content": c.content,
            "is_spoiler": bool(getattr(c, "is_spoiler", False)),
            "created_at": str(c.created_at),
            "parent_id": c.parent_id,
            "report_count": report_count_map.get(int(c.id), 0),
            "latest_report_reason": latest_reason_map.get(int(c.id)),
            "target_label": target_label,
            **seri,
        })

    return {
        "status": "success",
        "data": data,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }


@router.post("/comments/{comment_id}/dismiss-reports")
async def dismiss_comment_reports(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_editor),
):
    if not db.query(models.Comment.id).filter(models.Comment.id == comment_id).first():
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    dismissed = (
        db.query(models.CommentReport)
        .filter(
            models.CommentReport.comment_id == comment_id,
            models.CommentReport.status == "open",
        )
        .update({"status": "dismissed"}, synchronize_session=False)
    )
    db.commit()
    return {"status": "success", "dismissed": int(dismissed or 0)}


@router.delete("/comments/{comment_id}")
async def delete_comment_admin(
    comment_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    from routers.comments import delete_comment_tree

    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    try:
        delete_comment_tree(db, comment)
        db.commit()
        invalidate_admin_stats_cache()
        return {"status": "success", "message": "Yorum ve yanıtları silindi"}
    except Exception:
        db.rollback()
        logger.exception("Yorum silme hatası (id=%s)", comment_id)
        raise HTTPException(status_code=500, detail="Yorum silinirken sunucu hatası oluştu.")


# ==================== DASHBOARD STATS ====================

@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cached = admin_stats_cache.get("stats")
    if cached is not None:
        return {"status": "success", "data": cached}

    stats = {
        "total_users": db.query(func.count(models.User.id)).scalar(),
        "total_webtoons": db.query(func.count(models.Webtoon.id)).scalar(),
        "published_webtoons": db.query(func.count(models.Webtoon.id)).filter(models.Webtoon.is_published == True).scalar(),
        "total_novels": db.query(func.count(models.Novel.id)).scalar(),
        "published_novels": db.query(func.count(models.Novel.id)).filter(models.Novel.is_published == True).scalar(),
        "total_episodes": db.query(func.count(models.WebtoonEpisode.id)).scalar(),
        "total_chapters": db.query(func.count(models.NovelChapter.id)).scalar(),
        "total_comments": db.query(func.count(models.Comment.id)).scalar(),
    }
    admin_stats_cache.set("stats", stats)
    return {"status": "success", "data": stats}


@router.get("/webtoon/{webtoon_id}/episodes")
def list_webtoon_episodes_for_admin(
    webtoon_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_editor),
):
    """Editör ve bot kontrolleri için bir webtoon'un bölüm listesini döner."""
    exists = db.query(models.Webtoon.id).filter(models.Webtoon.id == webtoon_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")

    rows = (
        db.query(
            models.WebtoonEpisode.id,
            models.WebtoonEpisode.webtoon_id,
            models.WebtoonEpisode.episode_number,
            models.WebtoonEpisode.title,
            models.WebtoonEpisode.is_published,
        )
        .filter(models.WebtoonEpisode.webtoon_id == webtoon_id)
        .order_by(models.WebtoonEpisode.episode_number.asc())
        .all()
    )
    return [
        {
            "id": int(r.id),
            "webtoon_id": int(r.webtoon_id),
            "episode_number": float(r.episode_number) if r.episode_number is not None else 0,
            "title": r.title or "",
            "is_published": bool(r.is_published),
        }
        for r in rows
    ]


_REFUSAL_PHRASES = (
    "i cannot",
    "i'm sorry, i cannot",
    "as an ai language model",
    "üzgünüm, bu içeriği",
)
_HEALTH_SCAN_ITEM_LIMIT = 100
_SHORT_CHAPTER_THRESHOLD = 1200


def _inspect_local_static_file(raw_path: Optional[str]) -> Optional[str]:
    """Yerel static dosyasını denetler; sorun varsa 'missing_file' veya 'empty_file' döner."""
    if not raw_path:
        return None
    cleaned = str(raw_path).strip().replace("\\", "/")
    if not cleaned or cleaned.startswith(("http://", "https://", "data:")):
        return None

    rel = cleaned.lstrip("/")
    if rel.startswith("static/"):
        rel = rel[len("static/"):]
    if not rel:
        return "missing_file"

    static_root = os.path.realpath(media_utils.STATIC_ROOT)
    candidate = os.path.realpath(os.path.join(static_root, rel))
    if candidate != static_root and not candidate.startswith(static_root + os.sep):
        return "missing_file"
    if not os.path.isfile(candidate):
        return "missing_file"
    try:
        if os.path.getsize(candidate) <= 0:
            return "empty_file"
    except OSError:
        return "missing_file"
    return None


def _strip_html_plain_text(raw_html: Optional[str]) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", raw_html or "")
    unescaped = html.unescape(without_tags)
    return re.sub(r"\s+", " ", unescaped).strip()


def _run_health_scan_sync(db: Session) -> dict:
    broken_images: List[dict] = []
    broken_images_total = 0

    image_rows = (
        db.query(
            models.EpisodeImage.id,
            models.EpisodeImage.episode_id,
            models.EpisodeImage.image_url,
            models.EpisodeImage.page_order,
            models.WebtoonEpisode.episode_number,
            models.Webtoon.id.label("webtoon_id"),
            models.Webtoon.title.label("webtoon_title"),
        )
        .join(models.WebtoonEpisode, models.EpisodeImage.episode_id == models.WebtoonEpisode.id)
        .join(models.Webtoon, models.WebtoonEpisode.webtoon_id == models.Webtoon.id)
        .all()
    )
    for row in image_rows:
        issue = _inspect_local_static_file(row.image_url)
        if issue:
            broken_images_total += 1
            if len(broken_images) < _HEALTH_SCAN_ITEM_LIMIT:
                broken_images.append(
                    {
                        "id": int(row.id),
                        "episode_id": int(row.episode_id),
                        "webtoon_id": int(row.webtoon_id),
                        "webtoon_title": row.webtoon_title or "",
                        "episode_number": row.episode_number,
                        "page_order": int(row.page_order or 0),
                        "image_url": row.image_url,
                        "reason": issue,
                    }
                )

    suspicious_chapters: List[dict] = []
    short_chapters_total = 0
    refusal_chapters_total = 0

    chapter_rows = (
        db.query(
            models.NovelChapter.id,
            models.NovelChapter.novel_id,
            models.NovelChapter.chapter_number,
            models.NovelChapter.title,
            models.NovelChapter.content,
            models.Novel.title.label("novel_title"),
            models.Novel.slug.label("novel_slug"),
        )
        .join(models.Novel, models.NovelChapter.novel_id == models.Novel.id)
        .filter(models.NovelChapter.is_published == True)
        .all()
    )
    for ch in chapter_rows:
        plain_text = _strip_html_plain_text(ch.content)
        lower_text = plain_text.lower()
        is_refusal = any(phrase in lower_text for phrase in _REFUSAL_PHRASES)
        is_short = len(plain_text) < _SHORT_CHAPTER_THRESHOLD
        if not is_refusal and not is_short:
            continue

        if is_refusal:
            refusal_chapters_total += 1
            reason = "refusal"
        else:
            short_chapters_total += 1
            reason = "short"

        if len(suspicious_chapters) < _HEALTH_SCAN_ITEM_LIMIT:
            suspicious_chapters.append(
                {
                    "id": int(ch.id),
                    "novel_id": int(ch.novel_id),
                    "novel_title": ch.novel_title or "",
                    "novel_slug": ch.novel_slug or "",
                    "chapter_number": ch.chapter_number,
                    "title": ch.title or "",
                    "length": len(plain_text),
                    "issue": reason,
                    "reason": reason,
                }
            )

    missing_covers: List[dict] = []
    missing_covers_total = 0

    for content_type, model_cls in (("webtoon", models.Webtoon), ("novel", models.Novel)):
        series_rows = db.query(
            model_cls.id,
            model_cls.title,
            model_cls.slug,
            model_cls.cover_image,
        ).all()
        for series in series_rows:
            issue = _inspect_local_static_file(series.cover_image)
            if issue:
                missing_covers_total += 1
                if len(missing_covers) < _HEALTH_SCAN_ITEM_LIMIT:
                    missing_covers.append(
                        {
                            "content_type": content_type,
                            "id": int(series.id),
                            "title": series.title or "",
                            "slug": series.slug or "",
                            "cover_image": series.cover_image,
                            "reason": issue,
                        }
                    )

    return {
        "summary": {
            "broken_images": broken_images_total,
            "short_chapters": short_chapters_total,
            "refusal_chapters": refusal_chapters_total,
            "missing_covers": missing_covers_total,
            "scanned_at": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
        },
        "broken_images": broken_images,
        "suspicious_chapters": suspicious_chapters,
        "missing_covers": missing_covers,
    }


@router.get("/health-scan")
async def get_health_scan(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_editor),
):
    """Kırık sayfa görsellerini, eksik kapakları ve şüpheli/kısa roman bölümlerini tarar."""
    return await run_in_threadpool(_run_health_scan_sync, db)
