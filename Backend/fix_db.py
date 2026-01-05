from database import engine
from sqlalchemy import text

def db_tamir_et():
    print("Veritabanı tamiri başlıyor...")
    
    with engine.connect() as connection:
        try:
            # 1. Eksik olan 'likes_count' sütununu ekle
            # SQL Server kullandığın için syntax buna uygun yazıldı.
            sql_komutu = text("ALTER TABLE episodes ADD likes_count INT DEFAULT 0;")
            
            connection.execute(sql_komutu)
            connection.commit()
            print("✅ BAŞARILI: 'likes_count' sütunu episodes tablosuna eklendi.")
            
        except Exception as e:
            # Eğer sütun zaten varsa hata verebilir, onu yakalayalım
            if "Column names in each table must be unique" in str(e):
                print("⚠️ BİLGİ: Sütun zaten varmış, işlem yapılmadı.")
            else:
                print(f"❌ HATA: {e}")

if __name__ == "__main__":
    db_tamir_et()