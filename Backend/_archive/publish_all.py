from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)

def publish_all():
    with engine.connect() as conn:
        print("--- PUBLISHING ALL EPISODES ---")
        
        # 1. Count unpublished
        count = conn.execute(text("SELECT COUNT(*) FROM webtoon_episodes WHERE is_published = FALSE")).scalar()
        print(f"Found {count} unpublished episodes.")
        
        if count > 0:
            # 2. Update
            conn.execute(text("UPDATE webtoon_episodes SET is_published = TRUE WHERE is_published = FALSE"))
            conn.commit()
            print(f"✅ Published {count} episodes.")
        else:
            print("✅ All episodes are already published.")
            
        # 3. Optional: Publish unpublished Webtoons too?
        w_count = conn.execute(text("SELECT COUNT(*) FROM webtoons WHERE is_published = FALSE")).scalar()
        if w_count > 0:
            print(f"Found {w_count} unpublished webtoons. Publishing...")
            conn.execute(text("UPDATE webtoons SET is_published = TRUE WHERE is_published = FALSE"))
            conn.commit()
            print(f"✅ Published {w_count} webtoons.")

if __name__ == "__main__":
    publish_all()
