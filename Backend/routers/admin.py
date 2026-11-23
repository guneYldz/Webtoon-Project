from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, func
from database import get_db 
import logging
import models 
import schemas
import os
import uuid
from typing import Optional, List
from routers.auth import get_current_admin  # ADMIN AUTH
from fastapi.encoders import jsonable_encoder
from utils.media import validate_and_save_image

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


def _remove_file_quietly(path: Optional[str]):
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


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
    t = getattr(obj, "type", None)
    if t is not None:
        data["type"] = getattr(t, "value", t)
    return data


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
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024
            )

        if banner_image and banner_image.filename:
            banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-"
            )

        base_slug = title.lower().replace(" ", "-").replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
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

        return {"status": "success", "message": "Webtoon başarıyla oluşturuldu!", "data": with_categories(new_webtoon)}

    except HTTPException:
        db.rollback()
        _remove_file_quietly(cover_path)
        _remove_file_quietly(banner_path)
        raise
    except Exception:
        db.rollback()
        _remove_file_quietly(cover_path)
        _remove_file_quietly(banner_path)
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
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    is_featured: Optional[bool] = Form(None),
    source_url: Optional[str] = Form(None),
    series_type: Optional[str] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    category_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    
    if title is not None:
        webtoon.title = title
    if summary is not None:
        webtoon.summary = summary
    if status is not None:
        webtoon.status = status
    if is_published is not None:
        webtoon.is_published = is_published
    if is_featured is not None:
        webtoon.is_featured = is_featured
    if source_url is not None:
        webtoon.source_url = source_url.strip() or None  # Boş string → NULL
    if series_type is not None:
        webtoon.type = parse_comic_type(series_type)

    new_cover_path = None
    new_banner_path = None
    old_cover_path = webtoon.cover_image
    old_banner_path = webtoon.banner_image

    try:
        if cover_image and cover_image.filename:
            new_cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024
            )
            webtoon.cover_image = new_cover_path

        if banner_image and banner_image.filename:
            new_banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-"
            )
            webtoon.banner_image = new_banner_path

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, webtoon, ids)

        db.commit()
        db.refresh(webtoon)

        if new_cover_path and old_cover_path and old_cover_path != new_cover_path:
            _remove_file_quietly(old_cover_path)
        if new_banner_path and old_banner_path and old_banner_path != new_banner_path:
            _remove_file_quietly(old_banner_path)

        return {"status": "success", "message": "Webtoon güncellendi", "data": with_categories(webtoon)}
    except HTTPException:
        db.rollback()
        _remove_file_quietly(new_cover_path)
        _remove_file_quietly(new_banner_path)
        raise
    except Exception:
        db.rollback()
        _remove_file_quietly(new_cover_path)
        _remove_file_quietly(new_banner_path)
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
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024
            )

        if banner_image and banner_image.filename:
            banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-"
            )

        base_slug = title.lower().replace(" ", "-").replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
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
        return {"status": "success", "message": "Novel oluşturuldu", "data": with_categories(new_novel)}
    except HTTPException:
        db.rollback()
        _remove_file_quietly(cover_path)
        _remove_file_quietly(banner_path)
        raise
    except Exception:
        db.rollback()
        _remove_file_quietly(cover_path)
        _remove_file_quietly(banner_path)
        logger.exception("Novel oluşturma hatası")
        raise HTTPException(status_code=500, detail="Novel oluşturulurken sunucu hatası oluştu.")


@router.put("/novels/{novel_id}")
async def update_novel(
    novel_id: int,
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    is_featured: Optional[bool] = Form(None),
    source_url: Optional[str] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    category_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    novel = db.query(models.Novel).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel bulunamadı")
    
    if title is not None:
        novel.title = title
    if summary is not None:
        novel.summary = summary
    if author is not None:
        novel.author = author
    if status is not None:
        novel.status = status
    if is_published is not None:
        novel.is_published = is_published
    if is_featured is not None:
        novel.is_featured = is_featured
    if source_url is not None:
        novel.source_url = source_url.strip() or None  # Boş string → NULL

    new_cover_path = None
    new_banner_path = None
    old_cover_path = novel.cover_image
    old_banner_path = novel.banner_image

    try:
        if cover_image and cover_image.filename:
            new_cover_path = await run_in_threadpool(
                validate_and_save_image, cover_image, UPLOAD_DIR, 15 * 1024 * 1024
            )
            novel.cover_image = new_cover_path

        if banner_image and banner_image.filename:
            new_banner_path = await run_in_threadpool(
                validate_and_save_image, banner_image, UPLOAD_DIR_BANNERS, 15 * 1024 * 1024, "banner-"
            )
            novel.banner_image = new_banner_path

        ids = parse_category_ids(category_ids)
        if ids is not None:
            set_item_categories(db, novel, ids)

        db.commit()
        db.refresh(novel)

        if new_cover_path and old_cover_path and old_cover_path != new_cover_path:
            _remove_file_quietly(old_cover_path)
        if new_banner_path and old_banner_path and old_banner_path != new_banner_path:
            _remove_file_quietly(old_banner_path)

        return {"status": "success", "message": "Novel güncellendi", "data": with_categories(novel)}
    except HTTPException:
        db.rollback()
        _remove_file_quietly(new_cover_path)
        _remove_file_quietly(new_banner_path)
        raise
    except Exception:
        db.rollback()
        _remove_file_quietly(new_cover_path)
        _remove_file_quietly(new_banner_path)
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
    
    try:
        db.commit()
        db.refresh(user)
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
    """Admin duyurusu — duyuru kanalına kaydeder + tüm aktif kullanıcılara bildirim gönderir."""
    from routers.notifications import create_notification

    title = title.strip()
    message = message.strip()
    if not title or not message:
        raise HTTPException(status_code=400, detail="Başlık ve mesaj zorunlu")

    safe_link = _validate_announcement_link(link)

    image_path = None
    try:
        if image and image.filename:
            image_path = await run_in_threadpool(
                validate_and_save_image, image, UPLOAD_DIR_ANNOUNCEMENTS, 10 * 1024 * 1024
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

        # 2) Herkese bildirim (tıklanınca duyuru sayfasına gider)
        users = db.query(models.User).filter(models.User.is_active == True).all()
        count = 0
        for u in users:
            create_notification(
                db,
                user_id=u.id,
                type_="announcement",
                title=title,
                message=message,
                link=duyuru_link,
            )
            count += 1

        db.commit()
        return {
            "status": "success",
            "message": f"Duyuru yayınlandı ve {count} kullanıcıya bildirildi",
            "sent_to": count,
            "announcement_id": announcement.id,
            "image": image_path,
        }
    except HTTPException:
        db.rollback()
        _remove_file_quietly(image_path)
        raise
    except Exception:
        db.rollback()
        _remove_file_quietly(image_path)
        logger.exception("Duyuru oluşturma hatası")
        raise HTTPException(status_code=500, detail="Duyuru yayınlanırken sunucu hatası oluştu.")


# ==================== YORUM PANELİ ====================

@router.get("/comments")
async def list_comments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    seri_type: Optional[str] = Query(None),  # "novel" | "webtoon"
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    from routers.comments import _seri_bilgisi, _COMMENT_LOAD_OPTIONS

    query = db.query(models.Comment)\
        .outerjoin(models.User, models.Comment.user_id == models.User.id)\
        .options(*_COMMENT_LOAD_OPTIONS)

    if search:
        query = query.filter(
            or_(
                models.Comment.content.ilike(f"%{search}%"),
                models.User.username.ilike(f"%{search}%")
            )
        )

    if seri_type == "novel":
        query = query.filter(models.Comment.novel_chapter_id.isnot(None))
    elif seri_type == "webtoon":
        query = query.filter(models.Comment.webtoon_episode_id.isnot(None))

    total = query.count()
    offset = (page - 1) * limit
    comments = query.order_by(models.Comment.created_at.desc()).offset(offset).limit(limit).all()

    data = []
    for c in comments:
        seri = _seri_bilgisi(c)
        data.append({
            "id": c.id,
            "username": c.user.username if c.user else "Silinmiş Kullanıcı",
            "user_id": c.user_id,
            "content": c.content,
            "created_at": str(c.created_at),
            "parent_id": c.parent_id,
            **seri,
        })

    return {
        "status": "success",
        "data": data,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }


@router.delete("/comments/{comment_id}")
async def delete_comment_admin(
    comment_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    try:
        # Önce yanıtları sil (FK kısıtlaması)
        db.query(models.Comment).filter(models.Comment.parent_id == comment_id).delete()
        db.delete(comment)
        db.commit()
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
    return {"status": "success", "data": stats}
