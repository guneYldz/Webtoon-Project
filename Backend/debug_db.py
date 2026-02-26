import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

DATABASE_URL = "postgresql://webtoon_admin:Hn4moZSWvtV6Qswj@localhost:5432/webtoon_db"
try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    print("--- WEBTOON EPISODES ---")
    episodes = db.query(models.WebtoonEpisode).all()
    print(f"Total Webtoon Episodes: {len(episodes)}")
    for ep in episodes[:5]:
        print(f"ID: {ep.id}, WebtoonID: {ep.webtoon_id}, Num: {ep.episode_number}, Pub: {ep.is_published}")

    print("\n--- NOVEL CHAPTERS ---")
    chapters = db.query(models.NovelChapter).all()
    print(f"Total Novel Chapters: {len(chapters)}")
    for ch in chapters[:5]:
        print(f"ID: {ch.id}, NovelID: {ch.novel_id}, Num: {ch.chapter_number}, Pub: {ch.is_published}")
        
except Exception as e:
    print("Hata oluştu:", str(e)[:200])
