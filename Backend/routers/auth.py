from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
import hashlib
import hmac
import re
import secrets
import models
import schemas
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, File, UploadFile
from typing import Optional
import os
from dotenv import load_dotenv
from utils.cache import invalidate_admin_stats_cache
from utils.media import delete_static_file_safe, validate_and_save_image

load_dotenv()

router = APIRouter(
    prefix="/auth",
    tags=["Authentication (Giriş/Kayıt)"]
)

# --- AYARLAR ---
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment değişkeni bulunamadı!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_COOKIE_NAME = "kaos_refresh_token"
REFRESH_TOKEN_EXPIRE_DAYS = 30
RESET_CODE_EXPIRE_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 5

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/giris-yap")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/giris-yap", auto_error=False)
_google_transport_request = None


def _get_google_request():
    global _google_transport_request
    if _google_transport_request is None:
        from google.auth.transport import requests as google_requests
        _google_transport_request = google_requests.Request()
    return _google_transport_request


# --- YARDIMCI FONKSİYONLAR ---
def sifreyi_hashle(password: str):
    return pwd_context.hash(password)


def sifreyi_dogrula(duz_sifre, hashlenmis_sifre):
    return pwd_context.verify(duz_sifre, hashlenmis_sifre)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_token(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def _get_client_ip(request: Request) -> str:
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()[:64]
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()[:64]
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


def _is_secure_cookie(request: Request) -> bool:
    env_val = os.getenv("COOKIE_SECURE", "").strip().lower()
    if env_val in ("false", "0", "no"):
        return False
    if env_val in ("true", "1", "yes"):
        return True
    host = (request.headers.get("host") or request.url.hostname or "").split(":")[0].lower()
    if host in ("localhost", "127.0.0.1", "0.0.0.0"):
        return False
    return True


def _issue_refresh_token(db: Session, user: models.User, request: Request, response: Response) -> str:
    raw_token = secrets.token_urlsafe(48)
    now = _utcnow_naive()
    db_rt = models.RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        created_at=now,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        ip_address=_get_client_ip(request),
    )
    db.add(db_rt)
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=_is_secure_cookie(request),
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )
    return raw_token


def _clear_refresh_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_is_secure_cookie(request),
        samesite="lax",
    )


def _revoke_all_user_sessions(db: Session, user: models.User) -> None:
    now = _utcnow_naive()
    user.token_version = (user.token_version or 1) + 1
    db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == user.id,
        models.RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)


def _generate_unique_username(db: Session, preferred: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "", (preferred or "").strip())
    if len(cleaned) < 2:
        cleaned = "okur"
    base = cleaned[:40]
    candidate = base
    while db.query(models.User).filter(func.lower(models.User.username) == candidate.lower()).first():
        candidate = f"{base[:42]}_{secrets.token_hex(3)}"
    return candidate


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _build_auth_payload(user: models.User) -> dict:
    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "tv": user.token_version or 1,
        }
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "user": schemas.UserOut.model_validate(user),
    }


def _check_token_version(payload: dict, user: models.User) -> bool:
    user_tv = int(user.token_version or 1)
    token_tv = payload.get("tv")
    if token_tv is not None:
        try:
            return int(token_tv) == user_tv
        except (ValueError, TypeError):
            return False
    # Eski (tv içermeyen) tokenlar yalnızca token_version artırılmadıysa geçerli kalır
    return user_tv <= 1


# --- GÜVENLİK GÖREVLİLERİ (DEPENDENCIES) ---

# 1. Standart Kullanıcı Kontrolü
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Gecersiz kimlik bilgisi (Token hatali)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") in ("reset", "sqladmin"):
            raise credentials_exception
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = db.query(models.User).filter(models.User.username == email).first()

    if user is None:
        raise credentials_exception

    if not _check_token_version(payload, user):
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabınız devre dışı bırakılmıştır."
        )

    return user

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    """Giriş yoksa veya kullanıcı pasifse None döner; tepki sayılarını herkese göstermek için."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") in ("reset", "sqladmin"):
            return None
        email = payload.get("sub")
        if not email:
            return None
    except JWTError:
        return None
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = db.query(models.User).filter(models.User.username == email).first()
    if not user or not user.is_active or not _check_token_version(payload, user):
        return None
    return user


# 2. ADMIN Kontrolü
def get_current_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için Admin yetkisi gerekiyor! 🚫"
        )
    return current_user

# 3. EDITOR Kontrolü
def get_current_editor(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için EDİTÖR veya ADMİN yetkisi gerekiyor! 🚫"
        )
    return current_user

# --- ENDPOINTLER ---

@router.post("/kayit-ol", status_code=status.HTTP_201_CREATED)
def kullanici_olustur(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    clean_email = str(payload.eposta).strip()
    clean_username = payload.kullanici_adi.strip()

    if db.query(models.User).filter(func.lower(models.User.email) == clean_email.lower()).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli!")
    
    if db.query(models.User).filter(func.lower(models.User.username) == clean_username.lower()).first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış!")

    gizli_sifre = sifreyi_hashle(payload.sifre)
    yeni_kullanici = models.User(
        username=clean_username,
        email=clean_email,
        password=gizli_sifre,
        role="user",
    )
    
    db.add(yeni_kullanici)
    db.commit()
    db.refresh(yeni_kullanici)
    invalidate_admin_stats_cache()
    return {"mesaj": "Kayit Basarili", "kullanici": yeni_kullanici.username}

@router.post("/giris-yap")
def giris_yap(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Kullanıcı adı veya E-posta ile giriş
    kullanici = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not kullanici:
        kullanici = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not kullanici or not sifreyi_dogrula(form_data.password, kullanici.password):
        raise HTTPException(status_code=400, detail="E-posta/Kullanıcı adı veya şifre hatali!")
    
    if not kullanici.is_active:
        raise HTTPException(status_code=403, detail="Hesabınız banlanmıştır! 🚫")

    _issue_refresh_token(db, kullanici, request, response)
    db.commit()
    db.refresh(kullanici)

    return _build_auth_payload(kullanici)


@router.post("/google")
def google_giris(
    payload: schemas.GoogleAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google ile giriş şu anda yapılandırılmamış.",
        )

    if payload.credential:
        from google.oauth2 import id_token as google_id_token

        try:
            id_info = google_id_token.verify_oauth2_token(
                payload.credential,
                _get_google_request(),
                google_client_id,
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz veya süresi dolmuş Google kimlik doğrulaması.",
            )
    else:
        import requests

        try:
            tokeninfo_res = requests.get(
                "https://www.googleapis.com/oauth2/v3/tokeninfo",
                params={"access_token": payload.access_token},
                timeout=8,
            )
        except requests.RequestException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google kimlik doğrulama servisine şu anda ulaşılamıyor.",
            )

        if tokeninfo_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz veya süresi dolmuş Google erişim belirteci.",
            )

        try:
            token_info = tokeninfo_res.json()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz Google tokeninfo yanıtı.",
            )

        if str(token_info.get("aud") or "").strip() != google_client_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google erişim belirteci bu uygulama için verilmemiş.",
            )

        try:
            userinfo_res = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"},
                timeout=8,
            )
        except requests.RequestException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google kullanıcı bilgisi servisine şu anda ulaşılamıyor.",
            )

        if userinfo_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google kullanıcı bilgileri alınamadı.",
            )

        try:
            id_info = userinfo_res.json()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz Google userinfo yanıtı.",
            )

    google_sub = str(id_info.get("sub") or "").strip()
    email = str(id_info.get("email") or "").strip()
    email_verified = id_info.get("email_verified")
    is_email_verified = email_verified is True or (
        isinstance(email_verified, str) and email_verified.strip().lower() == "true"
    )
    if not google_sub or not email or not is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Doğrulanmış Google e-posta hesabı gereklidir.",
        )

    user = db.query(models.User).filter(models.User.google_id == google_sub).first()
    if not user:
        user = db.query(models.User).filter(func.lower(models.User.email) == email.lower()).first()
        if user:
            user.google_id = google_sub

    if not user:
        preferred_name = str(id_info.get("name") or email.split("@")[0])
        unique_username = _generate_unique_username(db, preferred_name)
        random_secret = sifreyi_hashle(secrets.token_urlsafe(48))
        user = models.User(
            username=unique_username,
            email=email,
            password=random_secret,
            google_id=google_sub,
            role="user",
            is_active=True,
            token_version=1,
        )
        db.add(user)
        db.flush()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabınız devre dışı bırakılmıştır.",
        )

    _issue_refresh_token(db, user, request, response)
    db.commit()
    db.refresh(user)

    return _build_auth_payload(user)


@router.post("/refresh")
def yenile_oturum(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    raw_cookie = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not raw_cookie:
        _clear_refresh_cookie(request, response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Oturum bulunamadı.")

    token_hash = _hash_token(raw_cookie)
    rt = db.query(models.RefreshToken).filter(models.RefreshToken.token_hash == token_hash).first()
    if not rt:
        _clear_refresh_cookie(request, response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz oturum.")

    user = db.query(models.User).filter(models.User.id == rt.user_id).first()

    # İptal edilmiş refresh token tekrar kullanılırsa güvenlik ihlali varsay: tüm oturumları kapat
    if rt.revoked_at is not None:
        if user:
            _revoke_all_user_sessions(db, user)
            db.commit()
        _clear_refresh_cookie(request, response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum güvenliği nedeniyle sonlandırıldı. Lütfen yeniden giriş yapın.",
        )

    now = _utcnow_naive()
    if rt.expires_at <= now:
        rt.revoked_at = now
        db.commit()
        _clear_refresh_cookie(request, response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Oturum süresi doldu.")

    if not user or not user.is_active:
        if user:
            _revoke_all_user_sessions(db, user)
            db.commit()
        _clear_refresh_cookie(request, response)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı.")

    # Eski tokenı iptal et, yenisini döndür (rotation)
    rt.revoked_at = now
    _issue_refresh_token(db, user, request, response)
    db.commit()
    db.refresh(user)

    return _build_auth_payload(user)


@router.post("/logout")
def cikis_yap(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    raw_cookie = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if raw_cookie:
        rt = db.query(models.RefreshToken).filter(
            models.RefreshToken.token_hash == _hash_token(raw_cookie),
            models.RefreshToken.revoked_at.is_(None),
        ).first()
        if rt:
            rt.revoked_at = _utcnow_naive()
            db.commit()

    _clear_refresh_cookie(request, response)
    return {"ok": True}


@router.post("/logout-all")
def tum_oturumlari_kapat(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _revoke_all_user_sessions(db, current_user)
    db.commit()
    _clear_refresh_cookie(request, response)
    return {"ok": True}


@router.get("/me", response_model=schemas.UserOut)
def beni_getir(current_user: models.User = Depends(get_current_user)):
    return current_user

# HERKESE AÇIK PROFİL ÖNİZLEME (yorumdaki isme/pp'ye tıklanınca)
# Dikkat: e-posta gibi özel bilgiler ASLA döndürülmez.
@router.get("/kullanici/{username}")
def kullanici_profili(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    comment_count = db.query(models.Comment).filter(models.Comment.user_id == user.id).count()
    favorite_count = db.query(models.Favorite).filter(models.Favorite.user_id == user.id).count()

    return {
        "username": user.username,
        "profile_image": user.profile_image,
        "role": user.role,
        "created_at": str(user.created_at),
        "comment_count": comment_count,
        "favorite_count": favorite_count,
    }

# --- PROFİL VE ŞİFRE İŞLEMLERİ ---

@router.post("/update-profile-image")
def profil_resmi_guncelle(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    file_path = validate_and_save_image(
        file,
        "static/profile_images",
        max_bytes=5 * 1024 * 1024,
        prefix=f"user_{current_user.id}_",
        max_width=512,
    )

    old_path = current_user.profile_image
    current_user.profile_image = file_path
    db.commit()
    db.refresh(current_user)

    if old_path and old_path != file_path:
        delete_static_file_safe(old_path)

    return {"message": "Profil fotoğrafı güncellendi", "image_url": file_path}

# --- Pydantic Modelleri ---
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# 1. PROFİL GÜNCELLEME
@router.put("/update-profile")
def profil_guncelle(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if user_data.username is not None:
        clean_username = user_data.username.strip()
        if len(clean_username) < 2 or len(clean_username) > 50:
            raise HTTPException(status_code=400, detail="Kullanıcı adı 2 ile 50 karakter arasında olmalıdır.")
        existing_user = db.query(models.User).filter(
            func.lower(models.User.username) == clean_username.lower(),
            models.User.id != current_user.id,
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış.")
        current_user.username = clean_username

    if user_data.email is not None:
        clean_email = str(user_data.email).strip()
        existing_email = db.query(models.User).filter(
            func.lower(models.User.email) == clean_email.lower(),
            models.User.id != current_user.id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanılıyor.")
        current_user.email = clean_email
    
    db.commit()
    db.refresh(current_user)
    return {
        "message": "Profil başarıyla güncellendi",
        "user": schemas.UserOut.model_validate(current_user),
    }

# 2. ŞİFRE DEĞİŞTİRME
@router.post("/change-password")
@router.put("/change-password", include_in_schema=False)
def sifre_degistir(
    pass_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not sifreyi_dogrula(pass_data.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Eski şifre hatalı")
    if len(pass_data.new_password) < 6 or len(pass_data.new_password) > 128:
        raise HTTPException(status_code=400, detail="Yeni şifre 6 ile 128 karakter arasında olmalıdır.")
    
    current_user.password = sifreyi_hashle(pass_data.new_password)
    _revoke_all_user_sessions(db, current_user)
    db.commit()
    return {"message": "Şifreniz başarıyla değiştirildi"}

# 3. ŞİFREMİ UNUTTUM (6 Haneli E-posta Kodu + Tek Tip Güvenli Yanıt)
@router.post("/sifremi-unuttum")
@router.post("/forgot-password", include_in_schema=False)
def sifremi_unuttum(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    clean_email = str(payload.email).strip()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email.lower()).first()
    if user and user.is_active:
        from utils.mailer import send_password_reset_email

        code = f"{secrets.randbelow(1000000):06d}"
        now = _utcnow_naive()

        # Önceki kullanılmamış kodları iptal et
        db.query(models.PasswordResetCode).filter(
            models.PasswordResetCode.user_id == user.id,
            models.PasswordResetCode.used_at.is_(None),
        ).update({"used_at": now}, synchronize_session=False)

        reset_row = models.PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_token(code),
            expires_at=now + timedelta(minutes=RESET_CODE_EXPIRE_MINUTES),
            attempts=0,
            created_at=now,
        )
        db.add(reset_row)
        db.commit()

        send_password_reset_email(user.email, code, user.username)

    return {
        "message": "Eğer bu e-posta adresi sistemimizde kayıtlıysa, 6 haneli şifre sıfırlama kodu gönderilmiştir."
    }

# 4. ŞİFRE SIFIRLAMA ONAYI (6 Haneli Kod Doğrulama + Tüm Oturumları İptal Etme)
@router.post("/sifre-yenile")
def sifre_sifirla(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    clean_email = str(payload.email).strip()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email.lower()).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama kodu.")

    now = _utcnow_naive()
    reset_row = (
        db.query(models.PasswordResetCode)
        .filter(
            models.PasswordResetCode.user_id == user.id,
            models.PasswordResetCode.used_at.is_(None),
        )
        .order_by(models.PasswordResetCode.created_at.desc(), models.PasswordResetCode.id.desc())
        .first()
    )

    if not reset_row:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama kodu.")

    if reset_row.expires_at <= now:
        reset_row.used_at = now
        db.commit()
        raise HTTPException(status_code=400, detail="Sıfırlama kodunun süresi dolmuş. Lütfen yeni kod isteyin.")

    if (reset_row.attempts or 0) >= RESET_CODE_MAX_ATTEMPTS:
        reset_row.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla hatalı deneme yapıldı. Lütfen yeni bir sıfırlama kodu isteyin.",
        )

    if not hmac.compare_digest(reset_row.code_hash, _hash_token(payload.code)):
        reset_row.attempts = (reset_row.attempts or 0) + 1
        if reset_row.attempts >= RESET_CODE_MAX_ATTEMPTS:
            reset_row.used_at = now
        db.commit()
        raise HTTPException(status_code=400, detail="Sıfırlama kodu hatalı.")

    user.password = sifreyi_hashle(payload.new_password)
    reset_row.used_at = now
    _revoke_all_user_sessions(db, user)
    db.commit()

    return {"message": "Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz."}