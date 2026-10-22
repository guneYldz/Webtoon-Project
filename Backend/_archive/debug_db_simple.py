from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

load_dotenv()

DB_URL = os.getenv("BOT_DB_CONNECTION") or os.getenv("DB_CONNECTION")
if not DB_URL:
    raise RuntimeError("BOT_DB_CONNECTION veya DB_CONNECTION .env içinde olmalı")

try:
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        print("Connected!")
        result = conn.execute(text("SELECT id, title, chapter_number, is_published FROM novel_chapters ORDER BY id DESC LIMIT 5"))
        print("\nLast 5 Chapters:")
        for row in result:
            print(row)
            
        print("\nNovels:")
        result_novels = conn.execute(text("SELECT id, title, is_published FROM novels ORDER BY id DESC LIMIT 5"))
        for row in result_novels:
            print(row)
except Exception as e:
    print(f"Error: {e}")
