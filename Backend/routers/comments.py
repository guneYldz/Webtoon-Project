from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from routers.auth import get_current_user
import models
from utils.chapter_title import chapter_display_label

router = APIRouter(
    prefix="/comments",
    tags=["Comments"]
)

# --- ŞEMALAR (Veri Doğrulama) ---
# Yorum gelirken bu formatta gelmeli:
class CommentCreate(BaseModel):
    content: str
    novel_chapter_id: Optional[int] = None
    webtoon_episode_id: Optional[int] = None
    parent_id: Optional[int] = None  # Yanıt verilen yorumun id'si (varsa)

# Yorum gönderirken bu formatta gitmeli:
class CommentResponse(BaseModel):
    id: int
    content: str
    user_username: str
    user_profile_image: Optional[str] = None
    parent_id: Optional[int] = None
    created_at: str 
    
    class Config:
        from_attributes = True

def _comment_to_dict(c):
    return {
        "id": c.id,
        "content": c.content,
        "user_username": c.user.username if c.user else "Silinmiş Kullanıcı",
        "user_profile_image": c.user.profile_image if c.user else None,
        "parent_id": c.parent_id,
        "created_at": str(c.created_at)
    }

def _seri_bilgisi(c):
    """Yorumun ait olduğu seri + bölüm bilgisi ve okuma sayfası linki."""
    if c.novel_chapter:
        novel = c.novel_chapter.novel
        # Novel URL'leri chapter_number kullanır (id değil — id yanlış bölüme gider)
        return {
            "seri_type": "novel",
            "seri_title": novel.title if novel else "Silinmiş Seri",
            "bolum_title": chapter_display_label(c.novel_chapter.title, c.novel_chapter.chapter_number),
            "link": f"/novel/{novel.slug}/bolum/{c.novel_chapter.chapter_number}" if novel else None,
        }
    if c.webtoon_episode:
        w = c.webtoon_episode.webtoon
        # Webtoon URL'leri episode id kullanır
        return {
            "seri_type": "webtoon",
            "seri_title": w.title if w else "Silinmiş Seri",
            "bolum_title": chapter_display_label(c.webtoon_episode.title, c.webtoon_episode.episode_number),
            "link": f"/webtoon/{w.slug or w.id}/bolum/{c.webtoon_episode.id}" if w else None,
        }
    return {"seri_type": None, "seri_title": None, "bolum_title": None, "link": None}

# Yorum listelerken seri/bölüm/kullanıcı ilişkilerini tek sorguda çekmek için
_COMMENT_LOAD_OPTIONS = [
    joinedload(models.Comment.user),
    joinedload(models.Comment.novel_chapter).joinedload(models.NovelChapter.novel),
    joinedload(models.Comment.webtoon_episode).joinedload(models.WebtoonEpisode.webtoon),
]

# 1. YORUM EKLE (POST /comments/)
# Frontend buraya istek atıyor, "/ekle" değil!
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_comment(
    comment: CommentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    novel_chapter_id = comment.novel_chapter_id
    webtoon_episode_id = comment.webtoon_episode_id

    # Yanıt ise: üst yorum var mı kontrol et, bölüm bilgisini ondan devral
    if comment.parent_id is not None:
        parent = db.query(models.Comment).filter(models.Comment.id == comment.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Yanıt verilen yorum bulunamadı.")
        novel_chapter_id = parent.novel_chapter_id
        webtoon_episode_id = parent.webtoon_episode_id

    new_comment = models.Comment(
        content=comment.content,
        user_id=current_user.id,
        novel_chapter_id=novel_chapter_id,
        webtoon_episode_id=webtoon_episode_id,
        parent_id=comment.parent_id
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Yanıt bildirimi: üst yorumun sahibine (kendine yanıt hariç)
    if comment.parent_id is not None:
        parent = db.query(models.Comment)\
            .options(*_COMMENT_LOAD_OPTIONS)\
            .filter(models.Comment.id == comment.parent_id)\
            .first()
        if parent and parent.user_id != current_user.id:
            from routers.notifications import create_notification
            seri = _seri_bilgisi(parent)
            preview = comment.content.strip()
            if len(preview) > 120:
                preview = preview[:117] + "..."
            # Yeni yanıtın id'siyle yorum yerine derin link
            base_link = seri.get("link") or ""
            deep_link = f"{base_link}#comment-{new_comment.id}" if base_link else None
            create_notification(
                db,
                user_id=parent.user_id,
                type_="reply",
                title=f"{current_user.username} yorumuna yanıt verdi",
                message=preview,
                link=deep_link,
            )
            db.commit()
    
    return {"message": "Yorum başarıyla eklendi", "id": new_comment.id}

# 2. WEBTOON YORUMLARI GETİR
@router.get("/webtoon/{episode_id}", response_model=List[CommentResponse])
def get_webtoon_comments(episode_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment)\
        .filter(models.Comment.webtoon_episode_id == episode_id)\
        .order_by(desc(models.Comment.created_at))\
        .all()
    
    return [_comment_to_dict(c) for c in comments]

# 3. ROMAN YORUMLARI GETİR
@router.get("/novel/{chapter_id}", response_model=List[CommentResponse])
def get_novel_comments(chapter_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment)\
        .filter(models.Comment.novel_chapter_id == chapter_id)\
        .order_by(desc(models.Comment.created_at))\
        .all()
        
    return [_comment_to_dict(c) for c in comments]

# 4. BİR KULLANICININ TÜM YORUMLARI (Profil sayfaları için — herkese açık)
@router.get("/kullanici/{username}")
def get_user_comments(username: str, limit: int = 100, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    comments = db.query(models.Comment)\
        .options(*_COMMENT_LOAD_OPTIONS)\
        .filter(models.Comment.user_id == user.id)\
        .order_by(desc(models.Comment.created_at))\
        .limit(min(limit, 200))\
        .all()

    return [{**_comment_to_dict(c), **_seri_bilgisi(c)} for c in comments]

# 5. YORUM SİL (Admin/Editor — yorum paneli için)
@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok.")

    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    # Önce bu yoruma verilen yanıtları sil (FK kısıtlaması patlamasın)
    db.query(models.Comment).filter(models.Comment.parent_id == comment_id).delete()
    db.delete(comment)
    db.commit()
    return {"message": "Yorum ve yanıtları silindi"}