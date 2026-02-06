from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# --- AYARLAR ---
DB_CONNECTION = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

engine = create_engine(DB_CONNECTION)

def create_admin():
    username = "bot123@gmail.com"
    password = "62dersim62"
    hashed_password = pwd_context.hash(password)
    
    print(f"🚀 Admin oluşturuluyor: {username}...")
    
    with engine.connect() as conn:
        # Önce bu kullanıcı var mı kontrol et
        check = conn.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username}).fetchone()
        
        if check:
            print("⚠️ Bu kullanıcı zaten var! Şifresi güncelleniyor...")
            conn.execute(
                text("UPDATE users SET password = :p, role = 'admin' WHERE id = :id"),
                {"p": hashed_password, "id": check[0]}
            )
        else:
            conn.execute(
                text("INSERT INTO users (username, email, password, role, is_active) VALUES (:u, :e, :p, 'admin', True)"),
                {"u": username, "e": username, "p": hashed_password}
            )
        
        conn.commit()
        print(f"✅ Başarılı! Artık '{username}' ve '{password}' ile giriş yapabilirsin.")

if __name__ == "__main__":
    try:
        create_admin()
    except Exception as e:
        print(f"❌ HATA: {e}")
