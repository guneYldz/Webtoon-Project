from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. AYARLAR
# Burayı kendi sunucunla değiştir! (Örn: DESKTOP-XYZ veya . )
SUNUCU_ADI = "."  
VERITABANI_ADI = "WebtoonDB"

DATABASE_URL = f"mssql+pyodbc://{SUNUCU_ADI}/{VERITABANI_ADI}?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"

# 2. MOTOR (Engine) - Arabanın Motoru
try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"Motor Hatası: {e}")

# 3. OTURUM AÇICI (SessionLocal) - İşte hatanın sebebi buydu, bu eksikti!
# Veritabanı ile her konuşmamızda yeni bir oturum açar.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. TABLO TEMELİ (Base)
# Tabloları oluştururken kullanacağımız zemin.
Base = declarative_base()

# 5. TEST FONKSİYONU (baglantiyi_test_et)
# main.py içindeki /db-test sayfası bunu kullanıyor.
def baglantiyi_test_et():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            print("BAŞARILI: Veritabanı bağlantısı süper! 🚀")
            return True
    except Exception as e:
        print(f"BAŞARISIZ: Bağlantı yok.\nHata: {e}")
        return False
    
# --- 6. YENİ EKLENEN KISIM: Dependency (Bağımlılık) ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()