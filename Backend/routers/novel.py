import math
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, File, UploadFile, Form, Query, status, Request, Response
from sqlalchemy.orm import Session, selectinload, defer
from sqlalchemy import desc, asc, func
from typing import List, Optional

# Proje dosyaları
from database import get_db
import models 
import schemas
from routers.auth import get_current_user, get_optional_user
from utils.chapter_title import (
    clean_chapter_number,
    default_chapter_title,
    chapter_display_label,
    format_chapter_number,
)
from utils.media import validate_and_save_image
from utils.query_helpers import parse_pg_int
from utils.sanitize import sanitize_novel_html
from utils.view_tracker import schedule_view_increment

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

def _to_chapter_summary(ch) -> schemas.NovelChapterListSchema:
    return schemas.NovelChapterListSchema(
        id=ch.id,
        chapter_number=clean_chapter_number(ch.chapter_number),
        title=ch.title or "",
        is_published=bool(ch.is_published),
        created_at=ch.created_at,
    )


def _to_category_out(cat: models.Category) -> schemas.CategoryOut:
    return schemas.CategoryOut(id=cat.id, name=cat.name)


# --- YARDIMCI FONSİYONLAR ---
def get_novels_logic(db: Session, limit: int, skip: int) -> List[schemas.NovelCard]:
    # RAM optimizasyonu: NovelChapter.content sütununu defer ile hariç tut ve yalnızca yayındaki bölümleri yükle
    query = db.query(models.Novel).filter(models.Novel.is_published == True).options(
        selectinload(models.Novel.chapters.and_(models.NovelChapter.is_published == True)).defer(
            models.NovelChapter.content
        ),
        selectinload(models.Novel.categories),
    )
    novels = query.order_by(desc(models.Novel.created_at)).offset(skip).limit(limit).all()

    cards: List[schemas.NovelCard] = []
    for n in novels:
        try:
            sorted_chapters = sorted(
                n.chapters,
                key=lambda x: (float(x.chapter_number) if x.chapter_number is not None else -1.0),
                reverse=True,
            )[:3]
        except Exception:
            sorted_chapters = list(n.chapters)[:3]

        cards.append(
            schemas.NovelCard(
                id=n.id,
                title=n.title or "",
                slug=n.slug,
                cover_image=n.cover_image,
                status=n.status or "ongoing",
                view_count=n.view_count or 0,
                source_url=n.source_url,
                is_published=bool(n.is_published),
                created_at=n.created_at,
                updated_at=getattr(n, "updated_at", None),
                chapters=[_to_chapter_summary(ch) for ch in sorted_chapters],
                categories=[_to_category_out(c) for c in (n.categories or [])],
            )
        )

    return cards

# 1. LİSTELEME
@router.get("/", response_model=List[schemas.NovelCard])
def novelleri_getir(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
):
    return get_novels_logic(db, limit, skip)

# 1.1 LİSTELEME (SLASHSIZ ERİŞİM İÇİN ALIAS - CORS FIX)
@router.get("", include_in_schema=False, response_model=List[schemas.NovelCard])
def novelleri_getir_no_slash(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
):
    return get_novels_logic(db, limit, skip)

# 2. TEK ROMAN GETİR
@router.get("/{slug_or_id}", response_model=schemas.NovelDetail)
def novel_detay(
    slug_or_id: str,
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    clean_key = (slug_or_id or "").strip()
    if clean_key.isdigit():
        parsed_id = parse_pg_int(clean_key)
        if parsed_id is None:
            raise HTTPException(status_code=404, detail="Roman bulunamadı")
        novel = db.query(models.Novel).options(selectinload(models.Novel.categories)).filter(models.Novel.id == parsed_id, models.Novel.is_published == True).first()
    else:
        novel = db.query(models.Novel).options(selectinload(models.Novel.categories)).filter(models.Novel.slug == clean_key, models.Novel.is_published == True).first()
        if not novel and clean_key:
            novel = db.query(models.Novel).options(selectinload(models.Novel.categories)).filter(
                func.trim(func.lower(models.Novel.slug)) == clean_key.lower(),
                models.Novel.is_published == True,
            ).first()

    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    novel_id = novel.id
    title = novel.title or ""
    slug = novel.slug or ""
    status_val = novel.status or "ongoing"
    summary = novel.summary
    cover_image = novel.cover_image
    banner_image = novel.banner_image
    author = novel.author
    current_views = novel.view_count or 0
    is_featured = bool(novel.is_featured)
    is_published = bool(novel.is_published)
    source_url = novel.source_url
    created_at = novel.created_at
    categories_out = [_to_category_out(c) for c in (novel.categories or [])]

    if schedule_view_increment(background_tasks, request, "novel", novel_id):
        current_views += 1

    chapters = (
        db.query(
            models.NovelChapter.id,
            models.NovelChapter.chapter_number,
            models.NovelChapter.title,
            models.NovelChapter.is_published,
            models.NovelChapter.created_at,
        )
        .filter(
            models.NovelChapter.novel_id == novel_id,
            models.NovelChapter.is_published == True,
        )
        .order_by(asc(models.NovelChapter.chapter_number))
        .all()
    )

    return schemas.NovelDetail(
        id=novel_id,
        title=title,
        slug=slug,
        status=status_val,
        summary=summary,
        cover_image=cover_image,
        banner_image=banner_image,
        author=author,
        view_count=current_views,
        is_featured=is_featured,
        is_published=is_published,
        source_url=source_url,
        created_at=created_at,
        chapters=[_to_chapter_summary(ch) for ch in chapters],
        categories=categories_out,
    )

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

    if db.query(models.Novel).filter(models.Novel.slug == slug).first():
        raise HTTPException(status_code=400, detail="Bu slug zaten kullanılıyor.")

    cover_path = None
    if cover and cover.filename:
        cover_path = validate_and_save_image(cover, "static/novel_covers", max_bytes=15 * 1024 * 1024)

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
    title: str = Form(""),
    content: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_editor_permission(current_user)

    novel = db.query(models.Novel).filter(models.Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı!")

    mevcut_bolum = db.query(models.NovelChapter).filter(
        models.NovelChapter.novel_id == novel_id,
        models.NovelChapter.chapter_number == chapter_number
    ).first()

    if mevcut_bolum:
        raise HTTPException(
            status_code=400, 
            detail=f"Bu roman için zaten Bölüm {chapter_number} mevcut!"
        )

    title = default_chapter_title(title, chapter_number)
    sanitized_content = sanitize_novel_html(content)

    yeni_bolum = models.NovelChapter(
        novel_id=novel_id,
        chapter_number=chapter_number,
        title=title,
        content=sanitized_content,
        is_published=True,
        view_count=0
    )

    db.add(yeni_bolum)
    db.commit()
    db.refresh(yeni_bolum)

    # Favorisinde bu roman olanlara bildirim
    try:
        from routers.notifications import notify_favorite_users_new_chapter
        ch_label = chapter_display_label(title, chapter_number)
        notify_favorite_users_new_chapter(
            db,
            novel_id=novel.id,
            series_title=novel.title,
            chapter_label=ch_label,
            link=f"/novel/{novel.slug}/bolum/{format_chapter_number(chapter_number)}",
        )
        db.commit()
    except Exception:
        pass

    return {"durum": "Başarılı", "mesaj": "Bölüm eklendi"}

# 5. OKUMA SAYFASI (🔥 FİNAL VERSİYON: KORUMALI & HYBRID LOCATOR 🔥)
@router.get("/{slug}/chapters/{chapter_identifier}")
def novel_bolum_oku(
    slug: str,
    chapter_identifier: str,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    is_privileged = bool(
        current_user and current_user.is_active and current_user.role in ("admin", "editor")
    )

    # Romanı bul
    clean_slug = (slug or "").strip()
    novel_query = db.query(models.Novel).filter(models.Novel.slug == clean_slug)
    if not is_privileged:
        novel_query = novel_query.filter(models.Novel.is_published == True)
    novel = novel_query.first()
    if not novel and clean_slug:
        fallback_q = db.query(models.Novel).filter(func.trim(func.lower(models.Novel.slug)) == clean_slug.lower())
        if not is_privileged:
            fallback_q = fallback_q.filter(models.Novel.is_published == True)
        novel = fallback_q.first()
    if not novel:
        raise HTTPException(status_code=404, detail="Roman bulunamadı")

    chapter = None

    # 1. Deneme: Identifier bir sonlu Float ise (Bölüm Numarası)
    try:
        c_num = float(chapter_identifier)
        if math.isfinite(c_num):
            ch_q = db.query(models.NovelChapter).filter(
                models.NovelChapter.novel_id == novel.id,
                models.NovelChapter.chapter_number == c_num
            )
            if not is_privileged:
                ch_q = ch_q.filter(models.NovelChapter.is_published == True)
            chapter = ch_q.first()
    except ValueError:
        pass

    # 2. Deneme: Eğer bulunamadıysa ve Identifier geçerli 32-bit pozitif Integer ise (ID olabilir)
    if not chapter:
        c_id = parse_pg_int(chapter_identifier)
        if c_id is not None:
            ch_q = db.query(models.NovelChapter).filter(
                models.NovelChapter.novel_id == novel.id,
                models.NovelChapter.id == c_id
            )
            if not is_privileged:
                ch_q = ch_q.filter(models.NovelChapter.is_published == True)
            chapter = ch_q.first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı (ID veya Numara ile eşleşmedi)")

    current_views = chapter.view_count or 0
    if schedule_view_increment(background_tasks, request, "novel_chapter", chapter.id):
        current_views += 1

    # Navigasyon (sadece chapter_number kolonu okunur — content hidrate edilmez)
    prev_q = db.query(models.NovelChapter.chapter_number).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number < chapter.chapter_number
    )
    next_q = db.query(models.NovelChapter.chapter_number).filter(
        models.NovelChapter.novel_id == novel.id,
        models.NovelChapter.chapter_number > chapter.chapter_number
    )
    if not is_privileged:
        prev_q = prev_q.filter(models.NovelChapter.is_published == True)
        next_q = next_q.filter(models.NovelChapter.is_published == True)

    prev_num = prev_q.order_by(desc(models.NovelChapter.chapter_number)).scalar()
    next_num = next_q.order_by(asc(models.NovelChapter.chapter_number)).scalar()

    return {
        "id": chapter.id,
        "title": chapter.title,
        "content": chapter.content,
        "chapter_number": clean_chapter_number(chapter.chapter_number),
        "novel_title": novel.title,
        "novel_slug": novel.slug,
        "novel_cover": novel.cover_image,
        "view_count": current_views,
        "created_at": chapter.created_at,
        "novel_id": novel.id,
        "prev_chapter": clean_chapter_number(prev_num) if prev_num is not None else None,
        "next_chapter": clean_chapter_number(next_num) if next_num is not None else None,
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
        num = new_chapter_number if new_chapter_number is not None else chapter.chapter_number
        chapter.title = default_chapter_title(title, num)
    if content is not None:
        chapter.content = sanitize_novel_html(content)
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

