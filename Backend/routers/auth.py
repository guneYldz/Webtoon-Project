from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic import BaseModel
import models
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from typing import Optional
import os
import shutil
import uuid

router = APIRouter(
    prefix="/auth",
    tags=["Authentication (Giriş/Kayıt)"]
)

# --- AYARLAR ---
SECRET_KEY = "cok_gizli_ve_uzun_bir_sifre_buraya_yazilir"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000 # Süreyi biraz uzattım rahat test et diye

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/giris-yap")

# --- YARDIMCI FONKSIYONLAR ---
def sifreyi_hashle(password: str):
    return pwd_context.hash(password)

def sifreyi_dogrula(duz_sifre, hashlenmis_sifre):
    return pwd_context.verify(duz_sifre, hashlenmis_sifre)

# 👇 İSMİ DÜZELTİLDİ: Artık her yerde bu ismi kullanacağız
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- GÜVENLİK GÖREVLİLERİ (DEPENDENCIES) ---

# 1. Standart Kullanıcı Kontrolü
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    print(f"🔍 AUTH DEBUG: Token received: {token[:20]}...")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Gecersiz kimlik bilgisi (Token hatali)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"🔍 AUTH DEBUG: Payload decoded: {payload}")
        email: str = payload.get("sub")
        role: str = payload.get("role")
        
        if email is None:
            print("❌ AUTH DEBUG: Email (sub) is None")
            raise credentials_exception
            
    except JWTError as e:
        print(f"❌ AUTH DEBUG: JWT Error: {str(e)}")
        raise credentials_exception

    # Önce username ile dene, olmazsa email ile dene
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
         user = db.query(models.User).filter(models.User.username == email).first()

    if user is None:
        print(f"❌ AUTH DEBUG: User not found in DB for sub: {email}")
        raise credentials_exception
        
    print(f"✅ AUTH DEBUG: User authenticated: {user.username} (Role: {user.role})")
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
def kullanici_olustur(kullanici_adi: str, eposta: str, sifre: str, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == eposta).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli!")
    
    if db.query(models.User).filter(models.User.username == kullanici_adi).first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış!")

    gizli_sifre = sifreyi_hashle(sifre)
    yeni_kullanici = models.User(username=kullanici_adi, email=eposta, password=gizli_sifre, role="user")
    
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

    # Token oluştur (create_access_token kullanıyoruz artık)
    # sub alanına email veya username koyabiliriz, get_current_user ikisini de anlıyor.
    access_token = create_access_token(
        data={"sub": kullanici.email, "role": kullanici.role}
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": kullanici.role,
        "username": kullanici.username 
    }

@router.get("/me")
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
    os.makedirs("static/profile_images", exist_ok=True)
    ext = file.filename.split(".")[-1]
    filename = f"user_{current_user.id}_{uuid.uuid4()}.{ext}"
    file_path = f"static/profile_images/{filename}"
    
    if current_user.profile_image:
        old_path = current_user.profile_image
        if os.path.exists(old_path):
            try: os.remove(old_path)
            except: pass

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.profile_image = file_path
    db.commit()
    db.refresh(current_user)
    return {"message": "Profil fotoğrafı güncellendi", "image_url": file_path}

# --- Pydantic Modelleri ---
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

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
    if user_data.username:
        current_user.username = user_data.username
    if user_data.email:
        existing_email = db.query(models.User).filter(models.User.email == user_data.email).first()
        if existing_email and existing_email.id != current_user.id:
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanılıyor.")
        current_user.email = user_data.email
    
    db.commit()
    db.refresh(current_user)
    return {"message": "Profil başarıyla güncellendi", "user": current_user}

# 2. ŞİFRE DEĞİŞTİRME
@router.post("/change-password")
def sifre_degistir(
    pass_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not sifreyi_dogrula(pass_data.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Eski şifre hatalı")
    
    current_user.password = sifreyi_hashle(pass_data.new_password)
    db.commit()
    return {"message": "Şifreniz başarıyla değiştirildi"}

# 3. ŞİFREMİ UNUTTUM (Token Oluşturur)
@router.post("/forgot-password")
def sifremi_unuttum(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Bu e-posta ile kayıtlı kullanıcı bulunamadı")

    # Geçici token oluştur (create_access_token artık tanımlı!)
    reset_token = create_access_token(
        data={"sub": user.email, "type": "reset"},
        expires_delta=timedelta(minutes=15)
    )

    print(f"\n==========================================")
    print(f"📧 [SİMÜLASYON E-POSTA] Şifre Sıfırlama Linki:")
    print(f"👉 KOD: {reset_token}")
    print(f"==========================================\n")

    return {"message": "Şifre sıfırlama kodu terminale (simülasyon) gönderildi."}

# 4. ŞİFRE SIFIRLAMA ONAYI
@router.post("/reset-password")
def sifre_sifirla(
    confirm: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(confirm.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("type")
        
        if email is None or token_type != "reset":
            raise HTTPException(status_code=400, detail="Geçersiz kod")
            
    except JWTError:
        raise HTTPException(status_code=400, detail="Kod geçersiz veya süresi dolmuş")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
    user.password = sifreyi_hashle(confirm.new_password)
    db.commit()
    
    return {"message": "Şifreniz başarıyla sıfırlandı."}