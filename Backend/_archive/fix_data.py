from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import WebtoonEpisode, Webtoon, User
from passlib.context import CryptContext

# Use localhost:5433 for host access
DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def fix_data():
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return

    try:
        print("--- Fixing Data ---")
        
        # 1. Publish Webtoon #1
        wt = db.query(Webtoon).filter(Webtoon.id == 1).first()
        if wt:
            if not wt.is_published:
                wt.is_published = True
                print(f"✅ Webtoon '1' ({wt.title}) published.")
            else:
                print(f"ℹ️ Webtoon '1' already published.")
        else:
            print("⚠️ Webtoon '1' not found.")

        # 2. Publish Episode #1
        ep = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == 1).first()
        if ep:
            if not ep.is_published:
                ep.is_published = True
                print(f"✅ Episode '1' ({ep.title}) published.")
            else:
                print(f"ℹ️ Episode '1' already published.")
        else:
            print("⚠️ Episode '1' not found.")
            
        # 3. Secure Admin (Optional but good)
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            # Check if password is weak or empty
            if not admin.password or len(admin.password) < 5:
                print("⚠️ Admin password weak/empty. Resetting to 'admin123'...")
                admin.password = pwd_context.hash("admin123")
                print("✅ Admin password reset.")
            else:
                 print("ℹ️ Admin user exists and has a password.")

        db.commit()
        print("\n--- Fix Complete ---")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_data()
