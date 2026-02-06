from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from Backend.database import get_db
from routers.auth import get_current_user
import models
import schemas  # <--- 1. YENİ: schemas dosyasını içeri aldık

router = APIRouter(
    prefix="/comments",
    tags=["Comments (Yorumlar)"]
)

# 1. YORUM YAP (Sadece Giris Yapanlar) 🔒
@router.post("/yap")
def yorum_yap(request: schemas.CommentCreate,  # <--- 2. DEĞİŞTİ: Tek tek parametre yerine 'request' geldi
              su_an_giris_yapan_kullanici: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    
    # Bölüm var mı kontrol et
    # 3. DEĞİŞTİ: Artık veriyi 'request.bolum_id' şeklinde alıyoruz
    bolum = db.query(models.Episode).filter(models.Episode.id == request.bolum_id).first()
    
    if not bolum:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı!")

    # Yorumu kaydet
    yeni_yorum = models.Comment(
        user_id=su_an_giris_yapan_kullanici.id,
        episode_id=request.bolum_id,  # <--- 4. GÜNCELLENDİ
        content=request.yorum         # <--- 5. GÜNCELLENDİ (request.yorum)
    )
    
    db.add(yeni_yorum)
    db.commit()
    return {"mesaj": "Yorum basariyla eklendi!", "yazan": su_an_giris_yapan_kullanici.username}

# 2. BÖLÜMÜN YORUMLARINI OKU (Burası Aynen Kalıyor)
@router.get("/oku/{bolum_id}")
def yorumlari_getir(bolum_id: int, db: Session = Depends(get_db)):
    yorumlar = db.query(models.Comment).filter(models.Comment.episode_id == bolum_id).all()
    return yorumlar