from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

# --- 1. Temel Parçalar ---

# Tür Tanımı (Bot ve Frontend kullanacak)
class ContentType(str, Enum):
    MANGA = "MANGA"
    NOVEL = "NOVEL"

# Resim Şeması
class EpisodeImageSchema(BaseModel):
    id: int
    image_url: str
    page_order: int

    class Config:
        from_attributes = True

class WebtoonBase(BaseModel):
    title: str
    summary: Optional[str] = None
    cover_image: str
    status: str = "ongoing"
    
    # Tür ve Kaynak
    type: ContentType = ContentType.MANGA 
    source_url: Optional[str] = None
    
    # 👇 YENİ: Vitrin Özelliği (Admin panelden işaretlenir)
    is_featured: bool = False 

# Bölüm Listesi (Özet)
class EpisodeListSchema(BaseModel):
    id: int
    title: str
    episode_number: float # 10.5 gibi bölümler için float daha güvenli
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# --- 2. Webtoon Şemaları ---

# Anasayfa Kartı
class WebtoonCard(BaseModel):
    id: int
    title: str
    cover_image: str
    status: str      
    view_count: int
    type: ContentType
    
    # 👇 YENİ: Frontend bunu görüp "Vitrindekiler" listesine alacak
    is_featured: bool 
    
    class Config:
        from_attributes = True

# Webtoon Detay Sayfası
class WebtoonDetail(WebtoonCard):
    summary: Optional[str] = None
    created_at: datetime
    source_url: Optional[str] = None
    episodes: List[EpisodeListSchema] = [] 

    class Config:
        from_attributes = True

# --- 3. Bölüm İşlem ve Okuma Şemaları ---

# Bot veya Admin bölüm eklerken
class EpisodeCreate(BaseModel):
    webtoon_id: int
    title: str
    episode_number: float 
    content_text: Optional[str] = None # Novel ise dolu, Manga ise boş

# Frontend 'Reader' Sayfası İçin (OKUMA MODU)
class EpisodeDetailSchema(BaseModel):
    id: int
    webtoon_id: int             
    webtoon_title: str          
    title: str                  
    episode_title: str          # Frontend bazen bu isimle arıyor (Opsiyonel)
    episode_number: float
    
    created_at: Optional[datetime]
    
    # MANGA ise resimler
    images: List[EpisodeImageSchema] = []
    
    # NOVEL ise metin 📖
    content_text: Optional[str] = None
    
    # Navigasyon (Önceki/Sonraki Bölüm)
    next_episode_id: Optional[int] = None
    prev_episode_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- 4. Kullanıcı Etkileşim Şemaları ---

class CommentCreate(BaseModel):
    bolum_id: int
    yorum: str

class CommentResponse(BaseModel):
    id: int
    user_username: str # Kullanıcı adını göstermek için
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class FavoriteCreate(BaseModel):
    webtoon_id: int

class LikeCreate(BaseModel):
    episode_id: int

# --- 5. Kullanıcı (Auth) Şemaları --- 
# (EKSİKTİ, EKLENDİ)

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime
    
    # 👇 YENİ: Banlı mı değil mi? Frontend bilsin.
    is_active: bool 

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- MEVCUT KODLARIN YUKARIDA ---

# 👇 NOVEL İÇİN ŞEMALAR (EN ALTA EKLE)

# 1. Roman Listesinde görünecek kart bilgisi
class NovelCard(BaseModel):
    id: int
    title: str
    slug: str
    cover_image: str | None = None
    status: str

    class Config:
        from_attributes = True

# 2. Bölüm Bilgisi (İçerik Dahil)
class NovelChapterBase(BaseModel):
    id: int
    chapter_number: int
    title: str
    content: str # Metin içeriği
    created_at: datetime

    class Config:
        from_attributes = True

# 3. Roman Detay Sayfası (Bölümlerle birlikte)
class NovelDetail(BaseModel):
    id: int
    title: str
    slug: str
    summary: str
    cover_image: str | None = None
    author: str | None = None
    chapters: List[NovelChapterBase] = [] # Bölüm listesi

    class Config:
        from_attributes = True