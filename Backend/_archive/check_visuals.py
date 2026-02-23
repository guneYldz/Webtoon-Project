from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

def check_images_detailed():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Check Webtoon #1
        row = conn.execute(text("SELECT id, title, cover_image, banner_image FROM webtoons WHERE id=1")).fetchone()
        if row:
            print(f"WEBTOON: {row[1]}")
            print(f" - Cover: {row[2]}")
            print(f" - Banner: {row[3]}")
        
        # Check Episode Images for Episode #1
        imgs = conn.execute(text("SELECT id, image_url FROM episode_images WHERE episode_id=1")).fetchall()
        print(f"\nEPISODE 1 IMAGES ({len(imgs)} found):")
        for img in imgs:
            print(f" - {img[1]}")

if __name__ == "__main__":
    check_images_detailed()
