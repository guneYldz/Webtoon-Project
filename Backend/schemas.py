from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

# ==========================================
# 1. TEMEL PARÇALAR VE ENUM
# ==========================================

class ContentType(str, Enum):
    MANGA = "MANGA"
    NOVEL = "NOVEL"

# ==========================================
# 2. YARDIMCI KÜÇÜK ŞEMALAR (ÖNCE BUNLAR TANIMLANMALI)
# ==========================================

# Webtoon Bölüm Resim Şeması
class EpisodeImageSchema(BaseModel):
    id: int
    image_url: str
    page_order: int
    
    class Config:
        from_attributes = True

# Webtoon Bölüm Listesi (Özet - Anasayfa için)
class EpisodeListSchema(BaseModel):
    id: int
    title: str
    episode_number: float 
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 👇 EKSİK OLAN KISIM BURASIYDI, EKLENDİ:
# Novel Bölüm Listesi (Özet - Anasayfa için)
class NovelChapterListSchema(BaseModel):
    id: int
    chapter_number: int
    title: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# 3. WEBTOON (MANGA) ŞEMALARI
# ==========================================

# Webtoon Ekleme Şeması (Admin/Bot)
class WebtoonBase(BaseModel):
    title: str
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    status: str = "ongoing"
    type: ContentType = ContentType.MANGA 
    source_url: Optional[str] = None
    is_featured: bool = False 

# Webtoon Kartı (Anasayfa Listeleme)
class WebtoonCard(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None
    cover_image: Optional[str] = None
    status: str      
    view_count: int = 0
    type: ContentType
    is_featured: bool 
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Anasayfada son bölümleri göstermek için
    episodes: List[EpisodeListSchema] = [] 
    
    class Config:
        from_attributes = True

# Webtoon Detay Sayfası
class WebtoonDetail(WebtoonCard):
    summary: Optional[str] = None
    source_url: Optional[str] = None
    # episodes zaten WebtoonCard'dan miras geliyor

    class Config:
        from_attributes = True

# ==========================================
# 4. NOVEL (ROMAN) ŞEMALARI
# ==========================================

# Roman Listesi Kartı (Anasayfa)
class NovelCard(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None
    cover_image: Optional[str] = None
    status: str
    source_url: Optional[str] = None 
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Anasayfada son bölümleri göstermek için
    chapters: List[NovelChapterListSchema] = []

    class Config:
        from_attributes = True

# Roman Bölümü (Okuma Sayfası İçin)
class NovelChapterBase(BaseModel):
    id: int
    novel_id: int
    chapter_number: int
    title: str
    content: str 
    created_at: Optional[datetime] = None
    
    # Yorum sistemi ve Header için gerekli
    novel_title: Optional[str] = None
    novel_cover: Optional[str] = None

    # Navigasyon
    prev_chapter: Optional[int] = None
    next_chapter: Optional[int] = None

    class Config:
        from_attributes = True

# Roman Detay Sayfası
class NovelDetail(BaseModel):
    id: int
    title: str
    slug: str
    status: str = "ongoing"
    summary: Optional[str] = None 
    cover_image: Optional[str] = None
    author: Optional[str] = None
    source_url: Optional[str] = None 
    
    chapters: List[NovelChapterBase] = [] 

    class Config:
        from_attributes = True

# ==========================================
# 5. BÖLÜM EKLEME VE OKUMA (GENEL)
# ==========================================

# Bölüm Ekleme (Bot/Admin)
class EpisodeCreate(BaseModel):
    webtoon_id: int
    title: str
    episode_number: float 
    content_text: Optional[str] = None

# Okuma Sayfası Detayı (Webtoon Reader)
class EpisodeDetailSchema(BaseModel):
    id: int
    webtoon_id: int             
    webtoon_title: str          
    title: str                  
    episode_number: float
    created_at: Optional[datetime] = None
    webtoon_cover: Optional[str] = None
    # İçerik
    images: List[EpisodeImageSchema] = []
    content_text: Optional[str] = None
    
    # Navigasyon
    next_episode_id: Optional[int] = None
    prev_episode_id: Optional[int] = None

    class Config:
        from_attributes = True

# ==========================================
# 6. KULLANICI ETKİLEŞİM (YORUM, FAVORİ, LİKE)
# ==========================================

# Yorum Ekleme
class CommentCreate(BaseModel):
    content: str
    chapter_id: int 
    novel_id: Optional[int] = None
    webtoon_id: Optional[int] = None

# Yorum Görüntüleme
class CommentOut(BaseModel):
    id: int
    content: str
    username: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class CommentResponse(CommentOut):
    pass

# Favori Ekleme
class FavoriteCreate(BaseModel):
    webtoon_id: Optional[int] = None
    novel_id: Optional[int] = None

# Beğeni Ekleme
class LikeCreate(BaseModel):
    episode_id: int

# ==========================================
# 7. KULLANICI (AUTH) ŞEMALARI
# ==========================================

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
    is_active: bool 

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str