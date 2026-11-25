from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
from routers.auth import get_current_user
import models
import schemas

router = APIRouter(
    prefix="/favorites",
    tags=["Favorites (Favoriler)"]
)

VALID_FAVORITE_STATUSES = {"reading", "plan_to_read", "completed", "dropped"}


def _validate_status(raw_status: Optional[str], *, default_if_none: Optional[str] = "reading") -> Optional[str]:
    if raw_status is None:
        return default_if_none
    cleaned = raw_status.strip().lower()
    if not cleaned:
        return default_if_none
    if cleaned not in VALID_FAVORITE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz durum. Yalnızca 'reading', 'plan_to_read', 'completed' veya 'dropped' olabilir.",
        )
    return cleaned


def _notify_value(fav: models.Favorite) -> bool:
    return True if fav.notify_new_chapters is None else bool(fav.notify_new_chapters)


def _status_value(fav: models.Favorite) -> str:
    return fav.status or "reading"


# ==========================================
# 1. FAVORİ EKLE / ÇIKAR (TOGGLE)
# ==========================================
@router.post("/toggle")
def favori_islem(
    request: schemas.FavoriteCreate,
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.webtoon_id:
        webtoon = db.query(models.Webtoon).filter(models.Webtoon.id == request.webtoon_id).first()
        if not webtoon:
            raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")

        mevcut_favori = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.webtoon_id == request.webtoon_id,
        ).first()

        if mevcut_favori:
            db.delete(mevcut_favori)
            db.commit()
            return {
                "mesaj": "Favorilerden çıkarıldı.",
                "durum": "cikarildi",
                "is_favorited": False,
                "is_favorite": False,
            }

        fav_status = _validate_status(request.status, default_if_none="reading")
        notify_flag = True if request.notify_new_chapters is None else bool(request.notify_new_chapters)
        yeni_favori = models.Favorite(
            user_id=kullanici.id,
            webtoon_id=request.webtoon_id,
            status=fav_status,
            notify_new_chapters=notify_flag,
        )
        db.add(yeni_favori)
        db.commit()
        return {
            "mesaj": "Favorilere eklendi!",
            "durum": "eklendi",
            "is_favorited": True,
            "is_favorite": True,
            "status": fav_status,
            "notify_new_chapters": notify_flag,
        }

    elif request.novel_id:
        novel = db.query(models.Novel).filter(models.Novel.id == request.novel_id).first()
        if not novel:
            raise HTTPException(status_code=404, detail="Roman bulunamadı!")

        mevcut_favori = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.novel_id == request.novel_id,
        ).first()

        if mevcut_favori:
            db.delete(mevcut_favori)
            db.commit()
            return {
                "mesaj": "Favorilerden çıkarıldı.",
                "durum": "cikarildi",
                "is_favorited": False,
                "is_favorite": False,
            }

        fav_status = _validate_status(request.status, default_if_none="reading")
        notify_flag = True if request.notify_new_chapters is None else bool(request.notify_new_chapters)
        yeni_favori = models.Favorite(
            user_id=kullanici.id,
            novel_id=request.novel_id,
            status=fav_status,
            notify_new_chapters=notify_flag,
        )
        db.add(yeni_favori)
        db.commit()
        return {
            "mesaj": "Favorilere eklendi!",
            "durum": "eklendi",
            "is_favorited": True,
            "is_favorite": True,
            "status": fav_status,
            "notify_new_chapters": notify_flag,
        }

    raise HTTPException(status_code=400, detail="Webtoon ID veya Novel ID göndermelisiniz.")


@router.patch("/guncelle")
def favori_guncelle(
    payload: schemas.FavoriteUpdate,
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if (payload.webtoon_id is None and payload.novel_id is None) or (
        payload.webtoon_id is not None and payload.novel_id is not None
    ):
        raise HTTPException(status_code=400, detail="Yalnızca webtoon_id veya novel_id göndermelisiniz.")

    validated_status = _validate_status(payload.status, default_if_none=None)

    if payload.webtoon_id is not None:
        if not db.query(models.Webtoon.id).filter(models.Webtoon.id == payload.webtoon_id).first():
            raise HTTPException(status_code=404, detail="Webtoon bulunamadı!")
        fav = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.webtoon_id == payload.webtoon_id,
        ).first()
    else:
        if not db.query(models.Novel.id).filter(models.Novel.id == payload.novel_id).first():
            raise HTTPException(status_code=404, detail="Roman bulunamadı!")
        fav = db.query(models.Favorite).filter(
            models.Favorite.user_id == kullanici.id,
            models.Favorite.novel_id == payload.novel_id,
        ).first()

    if fav is None:
        if validated_status is None:
            raise HTTPException(status_code=404, detail="Bu seri favorilerinizde değil.")
        fav = models.Favorite(
            user_id=kullanici.id,
            webtoon_id=payload.webtoon_id,
            novel_id=payload.novel_id,
            status=validated_status,
            notify_new_chapters=True if payload.notify_new_chapters is None else bool(payload.notify_new_chapters),
        )
        db.add(fav)
    else:
        if validated_status is not None:
            fav.status = validated_status
        if payload.notify_new_chapters is not None:
            fav.notify_new_chapters = bool(payload.notify_new_chapters)

    db.commit()
    db.refresh(fav)
    return {
        "is_favorite": True,
        "is_favorited": True,
        "status": _status_value(fav),
        "notify_new_chapters": _notify_value(fav),
    }


# ==========================================
# 2. FAVORİ DURUMU KONTROL ET (FRONTEND İÇİN)
# ==========================================
def _check_response(fav: Optional[models.Favorite]) -> dict:
    if not fav:
        return {"is_favorited": False, "is_favorite": False}
    return {
        "is_favorited": True,
        "is_favorite": True,
        "status": _status_value(fav),
        "notify_new_chapters": _notify_value(fav),
    }


@router.get("/check/{type}/{id}")
def check_favorite_generic(
    type: str,
    id: int,
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Favorite).filter(models.Favorite.user_id == kullanici.id)
    if type == "webtoon":
        query = query.filter(models.Favorite.webtoon_id == id)
    elif type == "novel":
        query = query.filter(models.Favorite.novel_id == id)
    else:
        return {"is_favorited": False, "is_favorite": False}
    return _check_response(query.first())


@router.get("/kontrol")
def kontrol_favorite_query(
    webtoon_id: Optional[int] = Query(default=None),
    novel_id: Optional[int] = Query(default=None),
    type: Optional[str] = Query(default=None),
    id: Optional[int] = Query(default=None),
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Favorite).filter(models.Favorite.user_id == kullanici.id)
    if webtoon_id is not None or (type == "webtoon" and id is not None):
        target_id = webtoon_id if webtoon_id is not None else id
        query = query.filter(models.Favorite.webtoon_id == target_id)
    elif novel_id is not None or (type == "novel" and id is not None):
        target_id = novel_id if novel_id is not None else id
        query = query.filter(models.Favorite.novel_id == target_id)
    else:
        raise HTTPException(status_code=400, detail="webtoon_id veya novel_id gereklidir.")
    return _check_response(query.first())


@router.get("/kontrol/{type}/{id}")
def kontrol_favorite_path(
    type: str,
    id: int,
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return check_favorite_generic(type, id, kullanici=kullanici, db=db)


# ==========================================
# 3. FAVORİLERİMİ LİSTELE (PROFİL İÇİN)
# ==========================================
def _favori_listesi(db: Session, user_id: int, status_filter: Optional[str] = None):
    q = (
        db.query(models.Favorite)
        .options(
            joinedload(models.Favorite.webtoon),
            joinedload(models.Favorite.novel),
        )
        .filter(models.Favorite.user_id == user_id)
    )
    if status_filter:
        q = q.filter(models.Favorite.status == status_filter)

    favoriler = q.order_by(desc(models.Favorite.added_at), desc(models.Favorite.id)).all()

    sonuc = []
    for fav in favoriler:
        if fav.webtoon:
            sonuc.append({
                "id": fav.webtoon.id,
                "type": "webtoon",
                "tag": "MANGA" if str(getattr(fav.webtoon.type, "value", fav.webtoon.type) or "").upper() == "MANGA" else "WEBTOON",
                "baslik": fav.webtoon.title,
                "resim": fav.webtoon.cover_image,
                "slug": f"/webtoon/{fav.webtoon.slug or fav.webtoon.id}",
                "status": _status_value(fav),
                "notify_new_chapters": _notify_value(fav),
            })
        elif fav.novel:
            sonuc.append({
                "id": fav.novel.id,
                "type": "novel",
                "tag": "NOVEL",
                "baslik": fav.novel.title,
                "resim": fav.novel.cover_image,
                "slug": f"/novel/{fav.novel.slug}",
                "status": _status_value(fav),
                "notify_new_chapters": _notify_value(fav),
            })

    return sonuc


@router.get("/listele")
def favorilerimi_getir(
    status: Optional[str] = Query(default=None),
    kullanici: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_filter = None
    if status is not None and status.strip().lower() not in ("", "all", "hepsi"):
        clean_filter = _validate_status(status, default_if_none=None)
    return _favori_listesi(db, kullanici.id, status_filter=clean_filter)


# ==========================================
# 4. BİR KULLANICININ FAVORİLERİ (Herkese açık profil önizleme)
# ==========================================
@router.get("/kullanici/{username}")
def kullanici_favorileri(
    username: str,
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    clean_filter = None
    if status is not None and status.strip().lower() not in ("", "all", "hepsi"):
        clean_filter = _validate_status(status, default_if_none=None)
    return _favori_listesi(db, user.id, status_filter=clean_filter)