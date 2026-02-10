from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)

def check_ep_5():
    with engine.connect() as conn:
        print("--- CHECKING EPISODE 5 ---")
        row = conn.execute(text("SELECT id, title, webtoon_id, is_published, created_at FROM webtoon_episodes WHERE id=5")).fetchone()
        if row:
            print(f"ID: {row[0]}")
            print(f"Title: {row[1]}")
            print(f"Webtoon ID: {row[2]}")
            print(f"Published: {row[3]}")
            print(f"Created At: {row[4]}")
            
            # Check Parent Webtoon
            w_row = conn.execute(text("SELECT id, title, is_published FROM webtoons WHERE id=:w"), {"w": row[2]}).fetchone()
            if w_row:
                 print(f"Parent Webtoon: {w_row[1]} (Published: {w_row[2]})")
        else:
            print("❌ Episode 5 NOT FOUND in DB.")

if __name__ == "__main__":
    check_ep_5()
