from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import WebtoonEpisode
from database import Base

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def debug_orm():
    db = SessionLocal()
    try:
        print("--- DEBUG ORM QUERY ---")
        ep_id = 5
        
        # Exact query match from routers/episode.py
        bolum = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id, WebtoonEpisode.is_published == True).first()
        
        if bolum:
            print(f"✅ Found Episode {bolum.id}: {bolum.title}")
            print(f"   Published: {bolum.is_published}")
            print(f"   Webtoon ID: {bolum.webtoon_id}")
        else:
            print(f"❌ ORM Query returned None for ID {ep_id}")
            
            # Check without filter
            bolum_all = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id).first()
            if bolum_all:
                print(f"   ℹ️ It exists without filter! Published value: {bolum_all.is_published} (Type: {type(bolum_all.is_published)})")
            else:
                 print("   ❌ Does not exist even without filter (via ORM)")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_orm()
