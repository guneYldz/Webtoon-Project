from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_user
import models
import schemas

router = APIRouter(
    prefix="/likes",
    tags=["Likes (Beğeniler)"]
)

# BEĞENİ İŞLEMİ (Toggle: Varsa Sil, Yoksa Ekle) ❤️
@router.post("/islem-yap")
def begeni_islem(request: schemas.LikeCreate, 
                 kullanici: models.User = Depends(get_current_user), 
                 db: Session = Depends(get_db)):
    
    # 1. Bölüm var mı?
    bolum = db.query(models.Episode).filter(models.Episode.id == request.episode_id).first()
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı!")

    # 2. Zaten beğenmiş mi?
    mevcut_begeni = db.query(models.Like).filter(
        models.Like.user_id == kullanici.id,
        models.Like.episode_id == request.episode_id
    ).first()

    # Eğer likes_count boşsa (None) sıfır yapalım ki hata vermesin
    if bolum.likes_count is None:
        bolum.likes_count = 0

    if mevcut_begeni:
        # --- BEĞENİ GERİ ALMA (UNLIKE) ---
        db.delete(mevcut_begeni)
        
        # Sayacı düşür (Eksiye düşmesini engelle)
        if bolum.likes_count > 0:
             bolum.likes_count -= 1
        
        db.commit()
        return {"mesaj": "Beğeni geri alındı", "durum": "silindi", "yeni_sayi": bolum.likes_count}
    
    else:
        # --- BEĞENME (LIKE) ---
        yeni_begeni = models.Like(user_id=kullanici.id, episode_id=request.episode_id)
        db.add(yeni_begeni)
        
        # Sayacı artır
        bolum.likes_count += 1
        
        db.commit()
        return {"mesaj": "Bölüm beğenildi!", "durum": "begenildi", "yeni_sayi": bolum.likes_count}