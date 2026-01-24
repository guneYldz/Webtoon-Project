from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List
import shutil
import os
import uuid

# Proje dosyaları
from database import get_db
import models 
import schemas
from routers.auth import get_current_user 

router = APIRouter(
    prefix="/novels",
    tags=["Novels (Romanlar)"]
)

# --- YETKİ KONTROL ---
def check_editor_permission(user: models.User):
    if user.role not in ["admin", "editor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Bu işlem için yetkiniz yok."
        )

# 1. LİSTELEME
@router.get("/", response_model=List[schemas.NovelCard])
def novelleri_getir(db: Session = Depends(get_db), limit: int = 100, skip: int = 0):
    return db.query(models.Novel).order_by(desc(models.Novel.created_at)).offset(skip).limit(limit).all()

# 2. TEK ROMAN GETİR
@router.get("/{slug_or_id}", response_model=schemas.NovelDetail)
def novel_detay(slug_or_id: str, db: Session = Depends(get_db)):
    if slug_or_id.isdigit():
        novel = db.query(models.Novel).filter(models.Novel.id == int(slug_or_id)).first()
    else:
        novel = db.query(models.Novel).filter(models.Novel.slug == slug_or_id).first()

    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")
    
    chapters = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id
    ).order_by(asc(models.NovelChapter.chapter_number)).all()
    
    novel.chapters = chapters
    return novel

# 3. YENİ ROMAN EKLE
@router.post("/ekle", status_code=status.HTTP_201_CREATED)
def novel_ekle(
    title: str = Form(...),
    slug: str = Form(...),
    summary: str = Form(...),
    author: str = Form(None),
    source_url: str = Form(None),
    cover: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_editor_permission(current_user)

    cover_path = None
    if cover:
        os.makedirs("static/novel_covers", exist_ok=True)
        ext = cover.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        cover_path = f"static/novel_covers/{filename}"
        with open(cover_path, "wb") as buffer:
            shutil.copyfileobj(cover.file, buffer)

    if db.query(models.Novel).filter(models.Novel.slug == slug).first():
        raise HTTPException(status_code=400, detail="Bu slug zaten kullanılıyor.")

    yeni_novel = models.Novel(
        title=title,
        slug=slug,
        summary=summary,
        author=author,
        cover_image=cover_path,
        status="ongoing",
        source_url=source_url 
    )
    
    db.add(yeni_novel)
    db.commit()
    db.refresh(yeni_novel)
    return {"durum": "Başarılı", "slug": yeni_novel.slug, "mesaj": "Roman oluşturuldu"}

# 4. BÖLÜM EKLEME
@router.post("/bolum-ekle", status_code=status.HTTP_201_CREATED)
def novel_bolum_ekle(
    novel_id: int = Form(...),
    chapter_number: float = Form(...),
    title: str = Form(...),
    content: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_editor_permission(current_user)

    mevcut_bolum = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel_id,
        models.NovelChapter.chapter_number == chapter_number
    ).first()

    if mevcut_bolum:
        raise HTTPException(
            status_code=400, 
            detail=f"Bu roman için zaten Bölüm {chapter_number} mevcut!"
        )

    yeni_bolum = models.NovelChapter(
        novel_id=novel_id,
        chapter_number=chapter_number,
        title=title,
        content=content,
        view_count=0
    )

    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum)
    return {"durum": "Başarılı", "mesaj": "Bölüm eklendi"}

# 5. OKUMA SAYFASI (🔥 FİNAL VERSİYON: KORUMALI 🔥)
@router.get("/{slug}/chapters/{chapter_number}")
def novel_bolum_oku(slug: str, chapter_number: float, request: Request, response: Response, db: Session = Depends(get_db)):
    
    # Romanı bul
    novel = db.query(models.Novel).filter(models.Novel.slug == slug).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    # Bölümü bul
    chapter = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number == chapter_number
    ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    # --- AKILLI SAYAÇ (SPAM KORUMALI) ---
    cookie_name = f"viewed_novel_{chapter.id}"
    zaten_okudu = request.cookies.get(cookie_name)

    if not zaten_okudu:
        if chapter.view_count is None:
            chapter.view_count = 0
        chapter.view_count += 1
        db.commit()
        
        # 1 Saat (3600 Saniye) boyunca tekrar artırma
        response.set_cookie(key=cookie_name, value="true", max_age=3600)
    # ------------------------------------

    # Navigasyon
    prev_ch = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number < chapter_number
    ).order_by(desc(models.NovelChapter.chapter_number)).first()

    next_ch = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number > chapter_number
    ).order_by(asc(models.NovelChapter.chapter_number)).first()

    return {
        "id": chapter.id,
        "title": chapter.title,
        "content": chapter.content,
        "chapter_number": chapter.chapter_number,
        "novel_title": novel.title,
        "novel_cover": novel.cover_image,
        "view_count": chapter.view_count, 
        "created_at": chapter.created_at, 
        "novel_id": novel.id, 
        "prev_chapter": prev_ch.chapter_number if prev_ch else None,
        "next_chapter": next_ch.chapter_number if next_ch else None
    }