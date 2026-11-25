from sqlalchemy import event
import logging
import models
from utils.media import delete_static_file_safe

logger = logging.getLogger(__name__)


# --- YARDIMCI: DOSYA SİLME ---
def delete_file(file_path):
    """Verilen dosya yolunu yalnızca Backend/static altındaysa güvenli biçimde siler."""
    if delete_static_file_safe(file_path):
        logger.info("Statik medya silindi: %s", file_path)


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


# --- 4. KULLANICI SİLİNİNCE ---
@event.listens_for(models.User, 'after_delete')
def delete_user_media(mapper, connection, target):
    delete_file(target.profile_image)


# --- 5. DUYURU SİLİNİNCE ---
@event.listens_for(models.Announcement, 'after_delete')
def delete_announcement_media(mapper, connection, target):
    delete_file(target.image)


print("✅ File Cleanup Signals Registered")
