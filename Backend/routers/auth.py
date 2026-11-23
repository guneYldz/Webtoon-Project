from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
import models
import schemas
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from typing import Optional
import os
from dotenv import load_dotenv
from utils.media import validate_and_save_image

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
ACCESS_TOKEN_EXPIRE_MINUTES = 3000

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/giris-yap")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/giris-yap", auto_error=False)

# --- YARDIMCI FONKSIYONLAR ---
def sifreyi_hashle(password: str):
    return pwd_context.hash(password)

def sifreyi_dogrula(duz_sifre, hashlenmis_sifre):
    return pwd_context.verify(duz_sifre, hashlenmis_sifre)

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
    if not user or not user.is_active:
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
    return {"mesaj": "Kayit Basarili", "kullanici": yeni_kullanici.username}

@router.post("/giris-yap")
def giris_yap(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Kullanıcı adı veya E-posta ile giriş
    kullanici = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not kullanici:
        kullanici = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not kullanici or not sifreyi_dogrula(form_data.password, kullanici.password):
        raise HTTPException(status_code=400, detail="E-posta/Kullanıcı adı veya şifre hatali!")
    
    if not kullanici.is_active:
        raise HTTPException(status_code=403, detail="Hesabınız banlanmıştır! 🚫")

    access_token = create_access_token(
        data={"sub": kullanici.email, "role": kullanici.role}
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": kullanici.role,
        "username": kullanici.username 
    }

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
    )

    old_path = current_user.profile_image
    current_user.profile_image = file_path
    db.commit()
    db.refresh(current_user)

    if old_path and old_path != file_path and os.path.exists(old_path):
        try:
            os.remove(old_path)
        except OSError:
            pass

    return {"message": "Profil fotoğrafı güncellendi", "image_url": file_path}

# --- Pydantic Modelleri ---
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
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
    db.commit()
    return {"message": "Şifreniz başarıyla değiştirildi"}

# 3. ŞİFREMİ UNUTTUM (Tek tip güvenli yanıt - kullanıcı numaralandırmayı engeller)
@router.post("/forgot-password")
def sifremi_unuttum(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    clean_email = request.email.strip()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email.lower()).first()
    if user and user.is_active:
        _reset_token = create_access_token(
            data={"sub": user.email, "type": "reset"},
            expires_delta=timedelta(minutes=15)
        )
        # TODO (Faz 1): Gerçek e-posta gönderimi (Resend / SMTP) entegre edilecek; token loglanmaz.

    return {
        "message": "Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama talimatları gönderilecektir."
    }

# 4. ŞİFRE SIFIRLAMA ONAYI
@router.post("/reset-password")
def sifre_sifirla(
    confirm: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    if len(confirm.new_password) < 6 or len(confirm.new_password) > 128:
        raise HTTPException(status_code=400, detail="Yeni şifre 6 ile 128 karakter arasında olmalıdır.")

    try:
        payload = jwt.decode(confirm.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("type")
        
        if email is None or token_type != "reset":
            raise HTTPException(status_code=400, detail="Geçersiz kod")
            
    except JWTError:
        raise HTTPException(status_code=400, detail="Kod geçersiz veya süresi dolmuş")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Kod geçersiz veya süresi dolmuş")
        
    user.password = sifreyi_hashle(confirm.new_password)
    db.commit()
    
    return {"message": "Şifreniz başarıyla sıfırlandı."}