from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# ==========================================
# ⚙️ AYARLAR
# ==========================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(CURRENT_DIR, ".env"))

# Docker'da olduğun için bu scripti Windows üzerinden 5433 portuyla çalıştıracağız
DB_CONNECTION = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

engine = create_engine(DB_CONNECTION)

def fix_database():
    print("🛠️ Veritabanı güncelleme işlemi başlatıldı...")
    
    commands = [
        # Webtoons tablosuna ekle
        "ALTER TABLE webtoons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE",
        
        # Webtoon Episodes tablosuna ekle
        "ALTER TABLE webtoon_episodes ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE",
        
        # Novels tablosuna ekle
        "ALTER TABLE novels ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE",
        
        # Novel Chapters tablosuna ekle
        "ALTER TABLE novel_chapters ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE",
    ]
    
    with engine.connect() as conn:
        for cmd in commands:
            try:
                conn.execute(text(cmd))
                conn.commit()
                print(f"✅ Komut başarılı: {cmd}")
            except Exception as e:
                print(f"❌ Hata ({cmd}): {e}")
                conn.rollback()

    print("\n🚀 İşlem tamamlandı! Artık botlar sorunsuz çalışacaktır.")

if __name__ == "__main__":
    fix_database()
