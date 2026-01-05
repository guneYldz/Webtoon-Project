from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from database import get_db
import models
# auth dosyanın nerede olduğuna göre değişebilir, senin kodunda 'routers.auth' idi:
from routers.auth import get_current_user 

router = APIRouter(
    prefix="/comments",
    tags=["Comments (Yorumlar)"]
)

# --- Şemalar (Veri Kalıpları) ---
# Frontend 'episode_id' ve 'content' gönderiyor, buna uyuyoruz:
class CommentCreate(BaseModel):
    episode_id: int
    content: str

# Frontend'e veriyi gönderirken kullanacağımız kalıp:
class CommentResponse(BaseModel):
    id: int
    user_username: str  # Yazan kişinin adı (Önemli!)
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 1. YORUM YAP 🔒
# Adres: POST /comments/ (Frontend buraya istek atıyor)
@router.post("/", status_code=status.HTTP_201_CREATED)
def yorum_yap(
    comment: CommentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Bölüm var mı?
    episode = db.query(models.Episode).filter(models.Episode.id == comment.episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")

    # Yorumu kaydet
    new_comment = models.Comment(
        user_id=current_user.id,
        episode_id=comment.episode_id,
        content=comment.content
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return {"message": "Yorum başarıyla eklendi"}

# 2. BİR BÖLÜMÜN YORUMLARINI GETİR 📖
# Adres: GET /comments/{episode_id}
@router.get("/{episode_id}", response_model=List[CommentResponse])
def yorumlari_getir(episode_id: int, db: Session = Depends(get_db)):
    # Yorumları 'en yeniden eskiye' doğru sıralayıp çekiyoruz
    comments = db.query(models.Comment)\
                 .filter(models.Comment.episode_id == episode_id)\
                 .order_by(models.Comment.created_at.desc())\
                 .all()
    
    # Veriyi Frontend'in istediği formata (CommentResponse) çeviriyoruz
    sonuc = []
    for c in comments:
        sonuc.append({
            "id": c.id,
            # Eğer kullanıcı silinmişse hata vermesin, 'Anonim' yazsın
            "user_username": c.user.username if c.user else "Anonim",
            "content": c.content,
            "created_at": c.created_at
        })
    return sonuc