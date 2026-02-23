from sqlalchemy import create_engine, text
import json
from datetime import datetime

def json_serial(obj):
    if isinstance(obj, (datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

DB_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

try:
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        print("--- CHECKING NOVELS ---")
        novels = conn.execute(text("SELECT id, title, slug, cover_image, is_published FROM novels")).fetchall()
        for n in novels:
            print(f"ID: {n.id}, Title: {n.title}, Slug: {n.slug}, Published: {n.is_published}")
            if not n.slug:
                print("❌ CRITICAL: SLUG IS MISSING!")
            if not n.cover_image:
                print("⚠️ WARNING: Cover image is missing")

        print("\n--- CHECKING CHAPTERS ---")
        chapters = conn.execute(text("SELECT id, novel_id, chapter_number, is_published FROM novel_chapters ORDER BY id DESC LIMIT 5")).fetchall()
        for c in chapters:
            print(f"ID: {c.id}, NovelID: {c.novel_id}, Num: {c.chapter_number}")

except Exception as e:
    print(f"Error: {e}")
