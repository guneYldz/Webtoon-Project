from sqlalchemy import text
from database import engine, baglantiyi_test_et # Merkezi ayarları çek

def sifirla():
    print("Test yapılıyor...")
    if not baglantiyi_test_et():
        print("Bağlantı olmadığı için işlem iptal edildi.")
        return

    print("🧹 Bölüm kayıtları temizleniyor...")
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM episode_images"))
        conn.execute(text("DELETE FROM webtoon_episodes"))
        conn.commit()
    print("✅ Temizlik bitti! Botu tekrar çalıştırabilirsin.")

if __name__ == "__main__":
    sifirla()