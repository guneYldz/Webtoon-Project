from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer # <--- YENI: Token tasiyici
from fastapi.security import OAuth2PasswordRequestForm
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

# Sifreleme Araci (Argon2)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Token'in nerede oldugunu sisteme soyluyoruz (Swagger icin gerekli)
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

# --- KRITIK BOLUM: GUVENLIK GOREVLISI (BOUNCER) --- 👮‍♂️
# Bu fonksiyonu diger dosyalardan (yorumlar vs.) cagiracagiz.
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Gecersiz kimlik bilgisi (Token hatali)",
        headers={"WWW-Authenticate": "Bearer"},
    )

    
    
    try:
        # 1. Token'i coz
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub") # Token icindeki gizli email'i al
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 2. Veritabaninda boyle biri hala var mi bak?
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
        
    return user # Gecis izni verildi! Kullanici objesini dondur.

# --- 1. KAYIT OL ---
@router.post("/kayit-ol")
def kullanici_olustur(kullanici_adi: str, eposta: str, sifre: str, db: Session = Depends(get_db)):
    # E-posta kontrol
    if db.query(models.User).filter(models.User.email == eposta).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli!")

    gizli_sifre = sifreyi_hashle(sifre)
    yeni_kullanici = models.User(username=kullanici_adi, email=eposta, password=gizli_sifre, role="user")
    
    db.add(yeni_kullanici)
    db.commit()
    db.refresh(yeni_kullanici)
    return {"mesaj": "Kayit Basarili", "kullanici": yeni_kullanici.username}

def get_current_admin(current_user: models.User = Depends(get_current_user)):
    """
    Bu fonksiyon, önce kullanıcının giriş yapıp yapmadığına bakar (get_current_user),
    Sonra da 'role' kısmının 'admin' olup olmadığını kontrol eder.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için Admin yetkisi gerekiyor!"
        )
    return current_user

# 4. (GEÇİCİ) KENDİNİ ADMİN YAPMA BUTONU 🛠️
# Uyarı: Proje bittiğinde bu kodu silmelisin!
@router.get("/beni-admin-yap")
def make_me_admin(email: str, db: Session = Depends(get_db)):
    # E-postası girilen kullanıcıyı bul
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Rolünü güncelle
    user.role = "admin"
    db.commit()
    
    return {"mesaj": f"Tebrikler! {user.username} ({email}) artık bir ADMIN "}

# --- 2. GIRIS YAP ---
@router.post("/giris-yap")
def giris_yap(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Swagger 'username' alanına e-postayı yazar, biz de oradan okuruz.
    kullanici = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not kullanici:
        raise HTTPException(status_code=400, detail="E-posta veya sifre hatali!")
    
    # Şifre kontrolü
    if not sifreyi_dogrula(form_data.password, kullanici.password):
        raise HTTPException(status_code=400, detail="E-posta veya sifre hatali!")

    # Token oluştur
    access_token = token_olustur(data={"sub": kullanici.email})
    
    return {"access_token": access_token, "token_type": "bearer"}

# --- 3. KULLANICI BILGILERINI GETIR (ME) ---
# Bu endpoint'e istek atan kişinin kim olduğunu token'dan anlar ve geri döndürür.
@router.get("/me")
def beni_getir(current_user: models.User = Depends(get_current_user)):
    return current_user

# --- 3. KULLANICI BİLGİLERİNİ GETİR (BENİ GETİR) ---
@router.get("/me")
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user