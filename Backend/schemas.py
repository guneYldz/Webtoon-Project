from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- 1. Temel Parçalar ---

# Resim Şeması (Bölüm içindeki sayfalar için)
class EpisodeImageSchema(BaseModel):
    image_url: str
    page_order: int

    class Config:
        from_attributes = True

# Bölüm Listesi Şeması (Webtoon detayında görünecek özet satırlar)
class EpisodeListSchema(BaseModel):
    id: int
    title: str
    episode_number: str
    created_at: Optional[datetime]
    # Not: Bölüm listesinde resimlere gerek yok, sadece başlık yeter.

    class Config:
        from_attributes = True

# --- 2. Webtoon Şemaları ---

# Anasayfada görünecek 'Kart' (Küçük kutu)
class WebtoonCard(BaseModel):
    id: int
    title: str
    cover_image: str
    status: str       # ongoing / completed
    view_count: int
    # Yazar adını şimdilik basit tutuyoruz, ileride User tablosundan çekeriz.

    class Config:
        from_attributes = True

# Webtoon Detay Sayfası (Tıklayınca açılan büyük sayfa)
class WebtoonDetail(WebtoonCard):
    summary: Optional[str] = None
    created_at: datetime
    # Bu webtoon'a ait bölümlerin listesi:
    episodes: List[EpisodeListSchema] = [] 

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    bolum_id: int
    yorum: str

# schemas.py dosyasına eklenecek:
class FavoriteCreate(BaseModel):
    webtoon_id: int


class LikeCreate(BaseModel):
    episode_id: int