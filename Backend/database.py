from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# ==========================================
# 1. AYARLAR (.env Dosyasından Yükle)
# ==========================================
load_dotenv() # .env dosyasını yükle

DATABASE_URL = os.getenv("DB_CONNECTION")

# 🚨 GÜVENLİK VE HATA KONTROLÜ
# Eğer bağlantı adresi yoksa programı burada durdur (Raise Error).
# Yoksa aşağıda "engine tanımlı değil" hatası alırsın.
if not DATABASE_URL:
    raise ValueError("❌ KRİTİK HATA: 'DB_CONNECTION' bulunamadı! Lütfen Backend/.env dosyasını kontrol edin.")

# ==========================================
# 2. MOTOR (Engine)
# ==========================================
# try-except KULLANMIYORUZ. Hata varsa direkt patlasın ki sebebini görelim.
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
except Exception as e:
    # Eğer bağlantı dizesi hatalıysa (örn: mssql+pyodbc yerine yanlış bir şey yazıldıysa)
    raise ValueError(f"❌ Veritabanı Motoru Başlatılamadı: {e}")

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
            print("✅ BAŞARILI: Veritabanı bağlantısı süper! 🚀")
            return True
    except Exception as e:
        print(f"❌ BAŞARISIZ: Bağlantı hatası.\nDetay: {e}")
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