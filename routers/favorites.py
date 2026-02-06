from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from Backend.database import get_db
from routers.auth import get_current_user 
import models
import schemas  # <--- 1. YENİ: Schemas dosyasını çağırdık

router = APIRouter(
    prefix="/favorites",
    tags=["Favorites (Favoriler)"]
)

# 1. FAVORİYE EKLE (Toggle Mantığı: Varsa siler, yoksa ekler) 🔄
@router.post("/islem-yap")
def favori_islem(request: schemas.FavoriteCreate,  # <--- 2. DEĞİŞTİ: Artık 'request' (JSON) bekliyor
                 kullanici: models.User = Depends(get_current_user), 
                 db: Session = Depends(get_db)):
    
    # 1. Webtoon var mı?
    # 3. DEĞİŞTİ: webtoon_id yerine request.webtoon_id kullanıyoruz
    webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == request.webtoon_id).first()
    
    if not webtoon:
        raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

    # 2. Zaten favoride mi?
    mevcut_favori = db.query(models.Favorite).filter(
        models.Favorite.user_id == kullanici.id,
        models.Favorite.webtoon_id == request.webtoon_id  # <--- 4. GÜNCELLENDİ
    ).first()

    if mevcut_favori:
        # Varsa sil (Favoriden çıkar)
        db.delete(mevcut_favori)
        db.commit()
        return {"mesaj": f"{webtoon.title} favorilerden çıkarıldı.", "durum": "cikarildi"}
    else:
        # Yoksa ekle
        # 5. GÜNCELLENDİ: request.webtoon_id
        yeni_favori = models.Favorite(user_id=kullanici.id, webtoon_id=request.webtoon_id)
        db.add(yeni_favori)
        db.commit()
        return {"mesaj": f"{webtoon.title} favorilere eklendi!", "durum": "eklendi"}

# 2. FAVORİLERİMİ LİSTELE 📜 (Burası Aynen Kalıyor)
@router.get("/listele")
def favorilerimi_getir(kullanici: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Kullanıcının favorilerini çekiyoruz
    favoriler = db.query(models.Favorite).filter(models.Favorite.user_id == kullanici.id).all()
    
    # Sadece Webtoon isimlerini ve ID'lerini döndürelim
    sonuc = []
    for fav in favoriler:
        sonuc.append({
            "webtoon_id": fav.webtoon.id,
            "baslik": fav.webtoon.title,
            "resim": fav.webtoon.cover_image
        })
        
    return sonuc