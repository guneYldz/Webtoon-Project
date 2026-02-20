from sqlalchemy import create_engine, text
import os
import json
from datetime import datetime

# Custom serializer for datetime
def json_serial(obj):
    if isinstance(obj, (datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

DB_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

try:
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        print("Connected! Fetching 'Shadow Slave'...")
        
        # 1. Fetch Novel Data
        novel = conn.execute(text("SELECT * FROM novels WHERE title LIKE '%Shadow Slave%'")).fetchone()
        
        if not novel:
            print("❌ 'Shadow Slave' not found in DB!")
        else:
            print("\n📚 NOVEL DATA:")
            # Convert row to dict for easier reading
            novel_dict = novel._asdict()
            print(json.dumps(novel_dict, indent=2, default=json_serial))
            
            novel_id = novel_dict['id']
            
            # 2. Fetch Recent Chapters
            print(f"\n📄 RECENT CHAPTERS (Novel ID: {novel_id}):")
            chapters = conn.execute(text(f"SELECT * FROM novel_chapters WHERE novel_id = {novel_id} ORDER BY chapter_number DESC LIMIT 3")).fetchall()
            
            for ch in chapters:
                print(json.dumps(ch._asdict(), indent=2, default=json_serial))

except Exception as e:
    print(f"Error: {e}")
