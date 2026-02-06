from sqlalchemy import event
import os
import models

# --- YARDIMCI: DOSYA SİLME ---
def delete_file(file_path):
    """Verilen dosya yolunu diskten siler."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"🗑️ Dosya silindi: {file_path}")
        except Exception as e:
            print(f"⚠️ Dosya silinemedi ({file_path}): {e}")

# --- 1. WEBTOON SİLİNİNCE ---
@event.listens_for(models.Webtoon, 'after_delete')
def delete_webtoon_media(mapper, connection, target):
    delete_file(target.cover_image)
    delete_file(target.banner_image)

# --- 2. ROMAN SİLİNİNCE ---
@event.listens_for(models.Novel, 'after_delete')
def delete_novel_media(mapper, connection, target):
    delete_file(target.cover_image)
    delete_file(target.banner_image)

# --- 3. BÖLÜM RESMİ SİLİNİNCE ---
# (Webtoon Bölümü silinince cascade ile bu da tetiklenir)
@event.listens_for(models.EpisodeImage, 'after_delete')
def delete_episode_image_file(mapper, connection, target):
    delete_file(target.image_url)

print("✅ File Cleanup Signals Registered")
