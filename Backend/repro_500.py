from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker, selectinload
from database import Base, engine # Re-use existing config
import models

SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    print("Attempting query from routers/novel.py...")
    # Mimic line 35 of routers/novel.py
    query = db.query(models.Novel).filter(models.Novel.is_published == True).options(
        selectinload(models.Novel.chapters.and_(models.NovelChapter.is_published == True))
    )
    results = query.order_by(desc(models.Novel.created_at)).limit(5).all()
    print(f"Success! Found {len(results)} novels")
except Exception as e:
    print(f"CRASHED: {e}")
finally:
    db.close()
