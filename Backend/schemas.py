from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

# --- 1. Temel Parçalar ---

# ✅ YENİ: Tür Tanımı (Bot ve Frontend bunu kullanacak)
class ContentType(str, Enum):
    MANGA = "MANGA"
    NOVEL = "NOVEL"

# Resim Şeması (Bölüm içindeki sayfalar için)
class EpisodeImageSchema(BaseModel):
    image_url: str
    page_order: int

    class Config:
        from_attributes = True

class WebtoonBase(BaseModel):
    title: str
    summary: Optional[str] = None
    cover_image: str
    status: str = "ongoing"
    
    # ✅ YENİ: Webtoon mu Novel mı? Ve Kaynak Linki ne?
    type: ContentType = ContentType.MANGA # Varsayılan Manga
    source_url: Optional[str] = None      # Bot için kaynak link

# Bölüm Listesi Şeması (Webtoon detayında görünecek özet satırlar)
class EpisodeListSchema(BaseModel):
    id: int
    title: str
    episode_number: int  
    created_at: Optional[datetime]
    # Not: Bölüm listesinde içeriğe gerek yok, sadece başlık yeter.

    class Config:
        from_attributes = True

# --- 2. Webtoon Şemaları ---

# Anasayfada görünecek 'Kart'
class WebtoonCard(BaseModel):
    id: int
    title: str
    cover_image: str
    status: str      
    view_count: int
    type: ContentType # ✅ YENİ: Kartın üzerinde Manga/Novel yazsın diye
    
    class Config:
        from_attributes = True

# Webtoon Detay Sayfası
class WebtoonDetail(WebtoonCard):
    summary: Optional[str] = None
    created_at: datetime
    episodes: List[EpisodeListSchema] = [] 
    
    # ✅ YENİ: Detay sayfasında kaynak linkini görmek isteyebilirsin (Admin panelde)
    source_url: Optional[str] = None

    class Config:
        from_attributes = True

# --- 3. Diğer İşlem Şemaları ---

class CommentCreate(BaseModel):
    bolum_id: int
    yorum: str

class FavoriteCreate(BaseModel):
    webtoon_id: int

class LikeCreate(BaseModel):
    episode_id: int

# ✅ GÜNCELLENDİ: Bot veya Admin bölüm eklerken bunları kullanacak
class EpisodeCreate(BaseModel):
    webtoon_id: int
    title: str
    episode_number: int # float da olabilir, arabölümler için (10.5 gibi)
    
    # Eğer Novel ise metin dolu olacak, Manga ise boş
    content_text: Optional[str] = None 

# ✅ YENİ: BÖLÜM OKUMA ŞEMASI (Frontend 'Reader' Sayfası İçin)
# Kullanıcı "Bölüm Oku" dediğinde API'den bu dönecek.

# ✅ YENİ: BÖLÜM OKUMA ŞEMASI (Frontend 'Reader' Sayfası İçin)
class EpisodeDetailSchema(BaseModel):
    id: int
    webtoon_id: int             # Seriye dönmek için lazım
    webtoon_title: str          # Navbar'da "Seri Adı" görünmesi için
    title: str                  # Bölüm Başlığı
    episode_title: str          # Frontend bazen bu isimle arıyor
    episode_number: int
    
    created_at: Optional[datetime]
    
    # MANGA ise resimler dolar
    images: List[EpisodeImageSchema] = []
    
    # NOVEL ise bu metin dolar (İşte sihirli alan burası!) 📖
    content_text: Optional[str] = None
    
    # Navigasyon
    next_episode_id: Optional[int] = None
    prev_episode_id: Optional[int] = None

    class Config:
        from_attributes = True