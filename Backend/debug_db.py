from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import WebtoonEpisode, User, Webtoon
import sys

# Use localhost:5433 for host access
DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

def debug_check():
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    with open("debug_result.txt", "w", encoding="utf-8") as f:
        try:
            f.write("--- Debugging Episode 1 ---\n")
            # Check Episode 1
            ep = db.query(WebtoonEpisode).filter(WebtoonEpisode.id == 1).first()
            if ep:
                f.write(f"Episode 1 found: Title='{ep.title}', Published={ep.is_published}, WebtoonID={ep.webtoon_id}\n")
                if not ep.is_published:
                    f.write("WARNING: Episode 1 is NOT published. This explains the 404 error.\n")
            else:
                f.write("Episode 1 NOT FOUND\n")
            
            f.write("\n--- Debugging Admin User ---\n")
            # Check Admin User
            admin = db.query(User).filter(User.role == "admin").first()
            if admin:
                f.write(f"Admin found: ID={admin.id}, Username='{admin.username}'\n")
                f.write(f"Password stored: '{admin.password}'\n")
                if not admin.password:
                    f.write("WARNING: Admin password is EMPTY.\n")
            else:
                f.write("Admin user NOT FOUND\n")

            f.write("\n--- Debugging Homepage Webtoons ---\n")
            # Check why homepage might be empty
            featured = db.query(Webtoon).filter(Webtoon.is_featured == True).all()
            f.write(f"Featured Webtoons count: {len(featured)}\n")
            for w in featured:
                 f.write(f" - {w.title} (Published: {w.is_published})\n")

        except Exception as e:
            f.write(f"Error: {e}\n")
        finally:
            db.close()

if __name__ == "__main__":
    debug_check()
