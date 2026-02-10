
from database import SessionLocal
from models import User
from passlib.context import CryptContext

# Şifreleme (Auth.py ile aynı)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def create_admin():
    db = SessionLocal()
    try:
        # Önce kontrol et
        existing_user = db.query(User).filter(User.username == "admin").first()
        if existing_user:
            print("❌ HATA: 'admin' kullanıcısı zaten var!")
            return

        # Yeni admin oluştur
        new_admin = User(
            username="admin",
            email="admin@example.com",
            password=pwd_context.hash("admin123"), # Şifre: admin123
            role="admin",
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        
        print("\n" + "="*40)
        print("✅ BAŞARILI: Admin kullanıcısı oluşturuldu!")
        print("👤 Kullanıcı Adı: admin")
        print("📧 E-posta:      admin@example.com")
        print("🔑 Şifre:        admin123")
        print("="*40 + "\n")
        
    except Exception as e:
        print(f"❌ HATA OLUŞTU: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
