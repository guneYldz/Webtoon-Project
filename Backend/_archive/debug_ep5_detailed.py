from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)

def debug_episode_fetch():
    with engine.connect() as conn:
        print("--- DEBUG EPISODE 5 ---")
        # Simulate the exact query from routers/episode.py
        # filter(models.WebtoonEpisode.id == 5, models.WebtoonEpisode.is_published == True)
        
        row = conn.execute(text("SELECT id, is_published FROM webtoon_episodes WHERE id=5")).fetchone()
        if row:
            print(f"Raw Row: ID={row[0]}, Published={row[1]} (Type: {type(row[1])})")
            if row[1] is True:
                print("✅ Py: is True")
            elif row[1] == 1:
                print("✅ Py: is 1")
            else:
                print(f"❌ Py: {row[1]}")
        else:
             print("❌ Row not found")

if __name__ == "__main__":
    debug_episode_fetch()
