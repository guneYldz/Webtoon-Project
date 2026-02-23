from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import WebtoonEpisode

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def fix_ep5():
    db = SessionLocal()
    try:
        print("--- FIXING EPISODE 5 ---")
        ep_id = 5
        
        # 1. Get raw
        ep = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id).first()
        if not ep:
            print("❌ Episode 5 not found!")
            return
            
        print(f"Current Status: {ep.is_published} (Type: {type(ep.is_published)})")
        
        # 2. Update
        print("Setting is_published = True...")
        ep.is_published = True
        db.commit()
        db.refresh(ep)
        
        print(f"New Status: {ep.is_published}")
        
        # 3. Test Filter
        check = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id, WebtoonEpisode.is_published == True).first()
        if check:
            print("✅ ORM Filter NOW WORKS!")
        else:
            print("❌ ORM Filter STILL FAILS!")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_ep5()
