from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db 
import models 
import shutil
import os
import uuid
from typing import Optional, List
import traceback
from routers.auth import get_current_admin  # ADMIN AUTH

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Paneli"]
)

UPLOAD_DIR = "static/covers"
UPLOAD_DIR_BANNERS = "static/banners"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR_BANNERS, exist_ok=True)


# ==================== WEBTOONS ====================

@router.post("/webtoon/create")
async def create_webtoon(
    title: str = Form(...),
    summary: str = Form(...),
    status: str = Form("ongoing"),
    is_published: bool = Form(False),
    is_featured: bool = Form(False),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    print(f"⚡ Admin isteği geldi: {title}")
    
    cover_path = None
    banner_path = None

    if cover_image and cover_image.filename:
        ext = cover_image.filename.split(".")[-1]
        new_name = f"{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR}/{new_name}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        
        cover_path = file_path.replace("\\", "/")
        print(f"   ✅ Kapak kaydedildi: {cover_path}")

    if banner_image and banner_image.filename:
        ext = banner_image.filename.split(".")[-1]
        new_name = f"banner-{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR_BANNERS}/{new_name}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(banner_image.file, buffer)
            
        banner_path = file_path.replace("\\", "/")
        print(f"   ✅ Banner kaydedildi: {banner_path}")

    try:
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
            cover_image=cover_path,
            banner_image=banner_path
        )

        db.add(new_webtoon)
        db.commit()
        db.refresh(new_webtoon)

        return {"status": "success", "message": "Webtoon başarıyla oluşturuldu!", "data": new_webtoon}

    except Exception as e:
        print("❌ HATA OLUŞTU:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Sunucu Hatası: {str(e)}")


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
    print(f"🔍 DEBUG: list_webtoons called by {current_admin.username}")
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
    
    print(f"   ✅ Total found: {total}")
    return {
        "status": "success",
        "data": webtoons,
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
    print(f"🔍 DEBUG: list_admin_webtoons called by {current_admin.username}")
    webtoons = db.query(models.Webtoon).order_by(models.Webtoon.id.desc()).all()
    return webtoons


@router.get("/webtoons/{webtoon_id}")
async def get_webtoon(
    webtoon_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == webtoon_id).first()
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı")
    return {"status": "success", "data": webtoon}


@router.put("/webtoons/{webtoon_id}")
async def update_webtoon(
    webtoon_id: int,
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    is_featured: Optional[bool] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
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
    
    if cover_image and cover_image.filename:
        ext = cover_image.filename.split(".")[-1]
        new_name = f"{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        webtoon.cover_image = file_path.replace("\\", "/")
    
    if banner_image and banner_image.filename:
        ext = banner_image.filename.split(".")[-1]
        new_name = f"banner-{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR_BANNERS}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(banner_image.file, buffer)
        webtoon.banner_image = file_path.replace("\\", "/")
    
    try:
        db.commit()
        db.refresh(webtoon)
        return {"status": "success", "message": "Webtoon güncellendi", "data": webtoon}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Güncelleme hatası: {str(e)}")


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Silme hatası: {str(e)}")


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
    print(f"🔍 DEBUG: list_admin_novels called by {current_admin.username}")
    novels = db.query(models.Novel).order_by(models.Novel.id.desc()).all()
    return novels


@router.get("/novels/{novel_id}")
async def get_novel(
    novel_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    novel = db.query(models.Novel).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel bulunamadı")
    return {"status": "success", "data": novel}


@router.post("/novels")
async def create_novel(
    title: str = Form(...),
    summary: str = Form(...),
    author: Optional[str] = Form(None),
    status: str = Form("ongoing"),
    is_published: bool = Form(False),
    is_featured: bool = Form(False),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    cover_path = None
    banner_path = None

    if cover_image and cover_image.filename:
        ext = cover_image.filename.split(".")[-1]
        new_name = f"{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        cover_path = file_path.replace("\\", "/")

    if banner_image and banner_image.filename:
        ext = banner_image.filename.split(".")[-1]
        new_name = f"banner-{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR_BANNERS}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(banner_image.file, buffer)
        banner_path = file_path.replace("\\", "/")

    try:
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
            cover_image=cover_path,
            banner_image=banner_path
        )

        db.add(new_novel)
        db.commit()
        db.refresh(new_novel)
        return {"status": "success", "message": "Novel oluşturuldu", "data": new_novel}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Hata: {str(e)}")


@router.put("/novels/{novel_id}")
async def update_novel(
    novel_id: int,
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    is_featured: Optional[bool] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
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
    
    if cover_image and cover_image.filename:
        ext = cover_image.filename.split(".")[-1]
        new_name = f"{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        novel.cover_image = file_path.replace("\\", "/")
    
    if banner_image and banner_image.filename:
        ext = banner_image.filename.split(".")[-1]
        new_name = f"banner-{uuid.uuid4()}.{ext}"
        file_path = f"{UPLOAD_DIR_BANNERS}/{new_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(banner_image.file, buffer)
        novel.banner_image = file_path.replace("\\", "/")
    
    try:
        db.commit()
        db.refresh(novel)
        return {"status": "success", "message": "Novel güncellendi", "data": novel}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
        "data": users,
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
    return {"status": "success", "data": user}


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
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    
    try:
        db.commit()
        return {"status": "success", "message": "Kullanıcı güncellendi", "data": user}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)  # AUTH
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    try:
        db.delete(user)
        db.commit()
        return {"status": "success", "message": f"'{user.username}' silindi"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
