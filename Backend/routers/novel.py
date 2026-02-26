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

# --- YARDIMCI FONSİYONLAR ---
def get_novels_logic(db: Session, limit: int, skip: int):
    # O P T I M İ Z A S Y O N EKLENDİ (N+1 Sorunu Çözümü)
    from sqlalchemy.orm import selectinload

    query = db.query(models.Novel).filter(models.Novel.is_published == True).options(selectinload(models.Novel.chapters))
    novels = query.order_by(desc(models.Novel.created_at)).offset(skip).limit(limit).all()
    
    # 🚀 Frontend Performans Yaması:
    for n in novels:
        # Bölümleri numaraya göre tersten (büyükten küçüğe) sırala ve ilk 3'ü al
        # ⚠️ CRITICAL SİGORTA: `chapter_number` None ise -1 kabul et
        try:
            n.chapters.sort(key=lambda x: (float(x.chapter_number) if x.chapter_number is not None else -1.0), reverse=True)
        except Exception:
            # Sort başarısız olursa (örn: veritabanı hatası) sıralamadan devam et
            pass
        n.chapters = n.chapters[:3]
        
    return novels

# 1. LİSTELEME
@router.get("/", response_model=List[schemas.NovelCard])
def novelleri_getir(db: Session = Depends(get_db), limit: int = 100, skip: int = 0):
    return get_novels_logic(db, limit, skip)

# 1.1 LİSTELEME (SLASHSIZ ERİŞİM İÇİN ALIAS - CORS FIX)
@router.get("", include_in_schema=False)
def novelleri_getir_no_slash(db: Session = Depends(get_db), limit: int = 100, skip: int = 0):
    return get_novels_logic(db, limit, skip)

# 2. TEK ROMAN GETİR
@router.get("/{slug_or_id}", response_model=schemas.NovelDetail)
def novel_detay(slug_or_id: str, response: Response, request: Request, db: Session = Depends(get_db)):
    if slug_or_id.isdigit():
        novel = db.query(models.Novel).filter(models.Novel.id == int(slug_or_id), models.Novel.is_published == True).first()
    else:
        novel = db.query(models.Novel).filter(models.Novel.slug == slug_or_id, models.Novel.is_published == True).first()

    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")
    
    
    # 🔥 YENİ SİSTEM: IP Tabanlı View Count Rate Limiting
    from utils.view_tracker import view_tracker
    
    client_ip = request.client.host
    
    # ViewTracker ile kontrol: Bu IP son 1 saat içinde bu romanı gördü mü?
    if view_tracker.should_count_view(client_ip, "novel", novel.id):
        # İlk defa görüntüleniyor (veya 1 saat geçmiş), sayacı artır
        if getattr(novel, 'view_count', None) is None:
            novel.view_count = 0
        novel.view_count += 1
        db.commit()
    
    chapters = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.is_published == True
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
        is_published=False,
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
        is_published=True,
        view_count=0
    )

    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum)
    return {"durum": "Başarılı", "mesaj": "Bölüm eklendi"}

# 5. OKUMA SAYFASI (🔥 FİNAL VERSİYON: KORUMALI & HYBRID LOCATOR 🔥)
@router.get("/{slug}/chapters/{chapter_identifier}")
def novel_bolum_oku(slug: str, chapter_identifier: str, request: Request, response: Response, db: Session = Depends(get_db)):
    
    # Romanı bul
    novel = db.query(models.Novel).filter(models.Novel.slug == slug).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    chapter = None

    # 1. Deneme: Identifier bir Float ise (Bölüm Numarası)
    is_float = False
    try:
        c_num = float(chapter_identifier)
        is_float = True
        chapter = db.query(models.NovelChapter).filter(
            models.NovelChapter.novel_id == novel.id,
            models.NovelChapter.chapter_number == c_num
        ).first()
    except ValueError:
        pass

    # 2. Deneme: Eğer bulunamadıysa ve Identifier bir Integer ise (ID olabilir)
    if not chapter and chapter_identifier.isdigit():
        c_id = int(chapter_identifier)
        chapter = db.query(models.NovelChapter).filter(
            models.NovelChapter.novel_id == novel.id,
            models.NovelChapter.id == c_id
        ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı (ID veya Numara ile eşleşmedi)")

    # 🔥 YENİ SİSTEM: IP Tabanlı View Count Rate Limiting
    from utils.view_tracker import view_tracker
    
    client_ip = request.client.host
    
    # Chapter view count (bölüm bazında)
    if view_tracker.should_count_view(client_ip, "novel_chapter", chapter.id):
        if chapter.view_count is None:
            chapter.view_count = 0
        chapter.view_count += 1
        db.commit()
    # ------------------------------------


    # Navigasyon
    prev_ch = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number < chapter.chapter_number
    ).order_by(desc(models.NovelChapter.chapter_number)).first()

    next_ch = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number > chapter.chapter_number
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


# 6. BÖLÜM SİLME (Admin/Editor)
@router.delete("/{slug}/chapters/{chapter_number}", status_code=status.HTTP_204_NO_CONTENT)
def novel_bolum_sil(
    slug: str, 
    chapter_number: float, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_editor_permission(current_user)

    novel = db.query(models.Novel).filter(models.Novel.slug == slug).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    chapter = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number == chapter_number
    ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    db.delete(chapter)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 7. BÖLÜM GÜNCELLEME (Admin/Editor)
@router.put("/{slug}/chapters/{chapter_number}")
def novel_bolum_guncelle(
    slug: str, 
    chapter_number: float, 
    title: str = Form(None),
    content: str = Form(None),
    new_chapter_number: float = Form(None),
    is_published: bool = Form(True), # Default True to avoid hiding by accident
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_editor_permission(current_user)

    novel = db.query(models.Novel).filter(models.Novel.slug == slug).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    chapter = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number == chapter_number
    ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    # Güncellemeler
    if title is not None:
        chapter.title = title
    if content is not None:
        chapter.content = content
    if is_published is not None:
        chapter.is_published = is_published
    
    # Eğer bölüm numarası değişiyorsa, çakışma kontrolü yap
    if new_chapter_number is not None and new_chapter_number != chapter_number:
        existing = db.query(models.NovelChapter).filter(
            models.NovelChapter.novel_id == novel.id,
            models.NovelChapter.chapter_number == new_chapter_number
        ).first()
        if existing:
             raise HTTPException(status_code=400, detail=f"Bölüm {new_chapter_number} zaten var!")
        chapter.chapter_number = new_chapter_number

    db.commit()
    db.refresh(chapter)

    return {"status": "success", "message": "Bölüm güncellendi", "data": {
        "id": chapter.id,
        "title": chapter.title,
        "chapter_number": chapter.chapter_number,
        "is_published": chapter.is_published
    }}

