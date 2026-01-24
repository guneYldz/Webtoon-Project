from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv # 👈 EKLENDİ: .env okumak için

# ==========================================
# 1. AYARLAR (.env Dosyasından Yükle)
# ==========================================

# .env dosyasını yükle
load_dotenv()

# Bağlantı adresini .env dosyasındaki DB_CONNECTION değişkeninden al
DATABASE_URL = os.getenv("DB_CONNECTION")

# Güvenlik Kontrolü: Eğer .env okunamazsa terminalde uyarı ver
if not DATABASE_URL:
    print("❌ KRİTİK HATA: DB_CONNECTION bulunamadı! '.env' dosyası Backend klasöründe mi?")

# ==========================================
# 2. MOTOR (Engine)
# ==========================================
try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"Motor Hatası: {e}")

# ==========================================
# 3. OTURUM AÇICI (SessionLocal)
# ==========================================
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==========================================
# 4. TABLO TEMELİ (Base)
# ==========================================
Base = declarative_base()

# ==========================================
# 5. TEST FONKSİYONU
# ==========================================
def baglantiyi_test_et():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            print("BAŞARILI: Veritabanı bağlantısı süper! 🚀")
            return True
    except Exception as e:
        print(f"BAŞARISIZ: Bağlantı yok.\nHata: {e}")
        return False

# ==========================================
# 6. BAĞIMLILIK (Dependency)
# ==========================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()