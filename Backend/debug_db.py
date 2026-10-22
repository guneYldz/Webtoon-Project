import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

load_dotenv()
DATABASE_URL = os.getenv("BOT_DB_CONNECTION") or os.getenv("DB_CONNECTION")
if not DATABASE_URL:
    raise RuntimeError("BOT_DB_CONNECTION veya DB_CONNECTION .env içinde olmalı")
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
