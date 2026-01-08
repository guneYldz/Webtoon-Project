from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
import models

router = APIRouter(
    prefix="/auth",
    tags=["Authentication (Giriş/Kayıt)"]
)

# --- AYARLAR ---
SECRET_KEY = "cok_gizli_ve_uzun_bir_sifre_buraya_yazilir"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/giris-yap")

# --- YARDIMCI FONKSIYONLAR ---
def sifreyi_hashle(password: str):
    return pwd_context.hash(password)

def sifreyi_dogrula(duz_sifre, hashlenmis_sifre):
    return pwd_context.verify(duz_sifre, hashlenmis_sifre)

def token_olustur(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
        
    return user

# 2. ADMIN Kontrolü (Bunu diğer dosyalarda kullanacağız!)
def get_current_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için Admin yetkisi gerekiyor! 🚫"
        )
    return current_user

# --- ENDPOINTLER ---

@router.post("/kayit-ol")
def kullanici_olustur(kullanici_adi: str, eposta: str, sifre: str, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == eposta).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli!")

    gizli_sifre = sifreyi_hashle(sifre)
    yeni_kullanici = models.User(username=kullanici_adi, email=eposta, password=gizli_sifre, role="user")
    
    db.add(yeni_kullanici)
    db.commit()
    db.refresh(yeni_kullanici)
    return {"mesaj": "Kayit Basarili", "kullanici": yeni_kullanici.username}

@router.post("/giris-yap")
def giris_yap(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    kullanici = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not kullanici or not sifreyi_dogrula(form_data.password, kullanici.password):
        raise HTTPException(status_code=400, detail="E-posta veya sifre hatali!")
    
    # Ban kontrolü (Bunu da ekleyelim tam olsun)
    if not kullanici.is_active:
        raise HTTPException(status_code=403, detail="Hesabınız banlanmıştır! 🚫")

    access_token = token_olustur(data={"sub": kullanici.email})
    
    # 👇 ARTIK ROLÜ DE GÖNDERİYORUZ
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": kullanici.role,       # admin / editor / user
        "username": kullanici.username 
    }

@router.get("/me")
def beni_getir(current_user: models.User = Depends(get_current_user)):
    return current_user

def get_current_editor(current_user: models.User = Depends(get_current_user)):
    # İzin verilen roller listesi
    izinli_roller = ["admin", "editor"]
    
    if current_user.role not in izinli_roller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için EDİTÖR veya ADMİN yetkisi gerekiyor! 🚫"
        )
    return current_user