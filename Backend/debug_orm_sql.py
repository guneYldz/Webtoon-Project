from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import WebtoonEpisode
import logging

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Enable SQL logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

def debug_orm_sql():
    db = SessionLocal()
    try:
        print("--- DEBUG ORM SQL ---")
        ep_id = 5
        
        # Construct query but don't execute yet
        q = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id, WebtoonEpisode.is_published == True)
        print(f"Generated SQL: {q}")
        
        bolum = q.first()
        
        if bolum:
            print(f"✅ Found: {bolum.title}")
        else:
            print("❌ Not Found with filter")
            
            # Check raw value again
            raw = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == ep_id).first()
            if raw:
                print(f"Raw Value: {raw.is_published} (Type: {type(raw.is_published)})")
                
                # Check if it equals True?
                if raw.is_published is True: print("IS True")
                if raw.is_published == True: print("EQ True")
                if raw.is_published: print("Truthiness is True")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_orm_sql()
