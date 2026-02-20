from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load env but handle the "db" host issue for local script
load_dotenv()
db_url = os.getenv("DB_CONNECTION")

# If running locally outside docker, 'db' host won't resolve. 
# We need to use localhost and the exposed port (usually 5432 or mapped one).
# From previous .env check: DB_CONNECTION="postgresql://webtoon_admin:gizlisifre123@db:5432/webtoon_db"
# The bot uses: BOT_DB_CONNECTION="postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db" (in comment)
# Let's try to parse and adapt, or just try localhost:5432 and 5433.

# Try connecting to localhost:5432 first (default mapping)
try:
    # Construct local URL manually to be safe
    local_db_url = "postgresql://webtoon_admin:gizlisifre123@localhost:5432/webtoon_db"
    engine = create_engine(local_db_url)
    with engine.connect() as conn:
        print("Connected to DB via localhost:5432")
        result = conn.execute(text("UPDATE novels SET is_published = TRUE WHERE source_url IS NOT NULL"))
        conn.commit()
        print(f"Updated {result.rowcount} novels to Published!")
except Exception as e:
    print(f"Failed on 5432: {e}")
    try:
        # Try 5433 (common alternative)
        local_db_url = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
        engine = create_engine(local_db_url)
        with engine.connect() as conn:
            print("Connected to DB via localhost:5433")
            result = conn.execute(text("UPDATE novels SET is_published = TRUE WHERE source_url IS NOT NULL"))
            conn.commit()
            print(f"Updated {result.rowcount} novels to Published!")
    except Exception as e2:
        print(f"Failed on 5433: {e2}")
        print("Could not connect to DB from host script. Please publish novels via Admin Panel.")
