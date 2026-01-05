from database import engine
from sqlalchemy import text

def veritabani_tamir():
    print("🛠️  Veritabanı tamiri başlıyor...")
    
    # SQL Server için sütun ekleme komutu
    # episodes tablosuna likes_count ekliyoruz, varsayılan değeri 0 yapıyoruz.
    sql_komutu = text("ALTER TABLE episodes ADD likes_count INT DEFAULT 0;")
    
    try:
        with engine.connect() as connection:
            connection.execute(sql_komutu)
            connection.commit()
            print("✅ BAŞARILI: 'likes_count' sütunu eklendi!")
    except Exception as e:
        print(f"❌ HATA OLUŞTU: {e}")
        print("Not: Hata 'Column already exists' diyorsa zaten eklenmiş demektir, sorun yok.")

if __name__ == "__main__":
    veritabani_tamir()