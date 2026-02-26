import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

DATABASE_URL = "postgresql://webtoon_admin:Hn4moZSWvtV6Qswj@localhost:5432/webtoon_db"
try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    episodes = db.query(models.WebtoonEpisode).filter(models.WebtoonEpisode.is_published == False).all()
    count = 0
    for ep in episodes:
        ep.is_published = True
        count += 1
    db.commit()
    print(f"Başarıyla {count} adet yayınlanmamış bölüm 'is_published=True' olarak güncellendi! 🎉")
except Exception as e:
    print("Hata oluştu:", str(e)[:200])
