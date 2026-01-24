from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from routers.auth import get_current_user
import models

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

# Yorum gönderirken bu formatta gitmeli:
class CommentResponse(BaseModel):
    id: int
    content: str
    user_username: str
    created_at: str 
    
    class Config:
        from_attributes = True

# 1. YORUM EKLE (POST /comments/)
# Frontend buraya istek atıyor, "/ekle" değil!
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_comment(
    comment: CommentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_comment = models.Comment(
        content=comment.content,
        user_id=current_user.id,
        novel_chapter_id=comment.novel_chapter_id,
        webtoon_episode_id=comment.webtoon_episode_id
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return {"message": "Yorum başarıyla eklendi", "id": new_comment.id}

# 2. WEBTOON YORUMLARI GETİR
@router.get("/webtoon/{episode_id}", response_model=List[CommentResponse])
def get_webtoon_comments(episode_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment)\
        .filter(models.Comment.webtoon_episode_id == episode_id)\
        .order_by(desc(models.Comment.created_at))\
        .all()
    
    return [
        {
            "id": c.id,
            "content": c.content,
            "user_username": c.user.username if c.user else "Silinmiş Kullanıcı",
            "created_at": str(c.created_at)
        } 
        for c in comments
    ]

# 3. ROMAN YORUMLARI GETİR
@router.get("/novel/{chapter_id}", response_model=List[CommentResponse])
def get_novel_comments(chapter_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment)\
        .filter(models.Comment.novel_chapter_id == chapter_id)\
        .order_by(desc(models.Comment.created_at))\
        .all()
        
    return [
        {
            "id": c.id,
            "content": c.content,
            "user_username": c.user.username if c.user else "Silinmiş Kullanıcı",
            "created_at": str(c.created_at)
        } 
        for c in comments
    ]