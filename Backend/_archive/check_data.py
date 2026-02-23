from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models

def check_data():
    db = SessionLocal()
    try:
        webtoon_count = db.query(models.Webtoon).count()
        novel_count = db.query(models.Novel).count()
        published_webtoons = db.query(models.Webtoon).filter(models.Webtoon.is_published == True).count()
        published_novels = db.query(models.Novel).filter(models.Novel.is_published == True).count()
        
        print(f"Total Webtoons: {webtoon_count} ({published_webtoons} published)")
        print(f"Total Novels: {novel_count} ({published_novels} published)")
        
        if webtoon_count > 0:
            first_w = db.query(models.Webtoon).first()
            print(f"First Webtoon: {first_w.title} (ID: {first_w.id}, Published: {first_w.is_published})")
            
        if novel_count > 0:
            first_n = db.query(models.Novel).first()
            print(f"First Novel: {first_n.title} (ID: {first_n.id}, Published: {first_n.is_published})")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
