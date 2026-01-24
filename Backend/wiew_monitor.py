import time
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Ayarları yükle
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DB_CONNECTION")

if not DATABASE_URL:
    print("❌ HATA: .env okunamadı.")
    exit()

try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"Motor Hatası: {e}")
    exit()

def izlenmeleri_goster():
    os.system('cls' if os.name == 'nt' else 'clear') 
    
    print("="*65)
    print("👀 WEBTOON & NOVEL CANLI İZLENME TAKİBİ")
    print("="*65)
    print(f"{'TÜR':<10} {'ID':<5} {'BAŞLIK':<35} {'İZLENME'}")
    print("-" * 65)

    try:
        with engine.connect() as conn:
            # 1. WEBTOONLARI ÇEK
            webtoons = conn.execute(text("""
                SELECT top 5 'WEBTOON' as tur, e.id, e.title, e.view_count 
                FROM webtoon_episodes e
                ORDER BY e.view_count DESC
            """)).fetchall()

            # 2. NOVELLERİ ÇEK
            novels = conn.execute(text("""
                SELECT top 5 'NOVEL' as tur, c.id, c.title, c.view_count 
                FROM novel_chapters c
                ORDER BY c.view_count DESC
            """)).fetchall()

            # LİSTEYİ BİRLEŞTİR
            tumu = webtoons + novels
            
            # Yazdır
            if not tumu:
                print("📭 Henüz hiç veri yok.")

            for row in tumu:
                tur = row[0]
                id_num = row[1]
                baslik = row[2]
                if baslik and len(baslik) > 33: baslik = baslik[:30] + "..."
                if not baslik: baslik = "Basliksiz"
                
                sayi = row[3] if row[3] is not None else 0
                
                renk = "🔵" if tur == "WEBTOON" else "🟣"
                print(f"{renk} {tur:<8} {id_num:<5} {baslik:<35} {sayi} 👁️")
                
    except Exception as e:
        print(f"⚠️ Veritabanı okuma hatası: {e}")
        print("İPUCU: 'novel_chapters' tablosunda 'view_count' sütunu olmayabilir.")

while True:
    izlenmeleri_goster()
    print("\n🔄 Veriler 3 saniyede bir güncelleniyor... (Çıkış: CTRL+C)")
    time.sleep(3)