from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_user 
import models
import schemas 

router = APIRouter(
    prefix="/favorites",
    tags=["Favorites (Favoriler)"]
)

# ==========================================
# 1. FAVORİ EKLE / ÇIKAR (TOGGLE)
# ==========================================
# Frontend "/toggle" adresine istek atıyor, burayı güncelledik.
@router.post("/toggle") 
def favori_islem(request: schemas.FavoriteCreate, 
                 kullanici: models.User = Depends(get_current_user), 
                 db: Session = Depends(get_db)):
    
    # --- SENARYO A: WEBTOON İÇİN ---
    if request.webtoon_id:
        # 1. Webtoon var mı?
        webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == request.webtoon_id).first()
        if not webtoon:
            raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

        # 2. Zaten favoride mi?
        mevcut_favori = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.webtoon_id == request.webtoon_id
        ).first()

        if mevcut_favori:
            db.delete(mevcut_favori)
            db.commit()
            # Frontend "is_favorited" bekliyor
            return {"mesaj": "Favorilerden çıkarıldı.", "durum": "cikarildi", "is_favorited": False}
        else:
            yeni_favori = models.Favorite(user_id=kullanici.id, webtoon_id=request.webtoon_id)
            db.add(yeni_favori)
            db.commit()
            return {"mesaj": "Favorilere eklendi!", "durum": "eklendi", "is_favorited": True}

    # --- SENARYO B: NOVEL (ROMAN) İÇİN ---
    elif request.novel_id:
        # 1. Novel var mı?
        novel = db.query(models.Novel).filter(models.Novel.id == request.novel_id).first()
        if not novel:
            raise HTTPException(status_code=404, detail="Roman bulunamadı!")

        # 2. Zaten favoride mi?
        mevcut_favori = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.novel_id == request.novel_id
        ).first()

        if mevcut_favori:
            db.delete(mevcut_favori)
            db.commit()
            return {"mesaj": "Favorilerden çıkarıldı.", "durum": "cikarildi", "is_favorited": False}
        else:
            yeni_favori = models.Favorite(user_id=kullanici.id, novel_id=request.novel_id)
            db.add(yeni_favori)
            db.commit()
            return {"mesaj": "Favorilere eklendi!", "durum": "eklendi", "is_favorited": True}

    else:
        raise HTTPException(status_code=400, detail="Webtoon ID veya Novel ID göndermelisiniz.")


# ==========================================
# 2. FAVORİ DURUMU KONTROL ET (FRONTEND İÇİN)
# ==========================================
# Frontend tek bir adrese istek atıyor: /check/{type}/{id}
# Bu yüzden o yapıyı buraya kuruyoruz.

@router.get("/check/{type}/{id}")
def check_favorite_generic(type: str, id: int, 
                           kullanici: models.User = Depends(get_current_user), 
                           db: Session = Depends(get_db)):
    
    query = db.query(models.Favorite).filter(models.Favorite.user_id == kullanici.id)
    
    if type == "webtoon":
        query = query.filter(models.Favorite.webtoon_id == id)
    elif type == "novel":
        query = query.filter(models.Favorite.novel_id == id)
    else:
        return {"is_favorited": False} # Geçersiz tip gelirse false dön

    fav = query.first()
    
    # Frontend "is_favorited" anahtarını bekliyor (sonunda 'd' harfi var)
    return {"is_favorited": bool(fav)}


# ==========================================
# 3. FAVORİLERİMİ LİSTELE (PROFİL İÇİN)
# ==========================================
@router.get("/listele")
def favorilerimi_getir(kullanici: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    favoriler = db.query(models.Favorite).filter(models.Favorite.user_id == kullanici.id).all()
    
    sonuc = []
    for fav in favoriler:
        if fav.webtoon:
            sonuc.append({
                "id": fav.webtoon.id,
                "type": "webtoon",
                "baslik": fav.webtoon.title,
                "resim": fav.webtoon.cover_image,
                "slug": f"/webtoon/{fav.webtoon.id}"
            })
        elif fav.novel:
            sonuc.append({
                "id": fav.novel.id,
                "type": "novel",
                "baslik": fav.novel.title,
                "resim": fav.novel.cover_image,
                "slug": f"/novel/{fav.novel.slug}"
            })
        
    return sonuc