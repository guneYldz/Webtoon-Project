from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum

# ==========================================
# 1. TEMEL PARÇALAR VE ENUM
# ==========================================

class ContentType(str, Enum):
    WEBTOON = "WEBTOON"
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
    is_published: bool = False
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 👇 EKSİK OLAN KISIM BURASIYDI, EKLENDİ:
# Novel Bölüm Listesi (Özet - Anasayfa için)
class NovelChapterListSchema(BaseModel):
    id: int
    chapter_number: float
    title: str
    is_published: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    name: str

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
    type: ContentType = ContentType.WEBTOON 
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
    is_published: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Anasayfada son bölümleri göstermek için
    episodes: List[EpisodeListSchema] = []
    categories: List[CategoryOut] = []
    
    class Config:
        from_attributes = True

# Webtoon Detay Sayfası
class WebtoonDetail(WebtoonCard):
    summary: Optional[str] = None
    source_url: Optional[str] = None
    categories: List[CategoryOut] = []
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
    view_count: int = 0
    source_url: Optional[str] = None 
    is_published: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Anasayfada son bölümleri göstermek için
    chapters: List[NovelChapterListSchema] = []
    categories: List[CategoryOut] = []

    class Config:
        from_attributes = True

# Roman Bölümü (Okuma Sayfası İçin)
class NovelChapterBase(BaseModel):
    id: int
    novel_id: int
    chapter_number: float
    title: str
    content: str 
    created_at: Optional[datetime] = None
    
    # Yorum sistemi ve Header için gerekli
    novel_title: Optional[str] = None
    novel_cover: Optional[str] = None

    # Navigasyon
    prev_chapter: Optional[float] = None
    next_chapter: Optional[float] = None

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
    banner_image: Optional[str] = None
    author: Optional[str] = None
    view_count: int = 0
    is_featured: bool = False
    is_published: bool = False
    source_url: Optional[str] = None 
    created_at: Optional[datetime] = None
    
    # 🔥 DÜZELTİLDİ: NovelChapterBase yerine NovelChapterListSchema
    chapters: List[NovelChapterListSchema] = []
    categories: List[CategoryOut] = []

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
    is_published: bool = False
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

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str = "user"
    is_active: bool = True
    profile_image: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    kullanici_adi: str = Field(..., min_length=2, max_length=50)
    eposta: EmailStr
    sifre: str = Field(..., min_length=6, max_length=128)

    @field_validator("kullanici_adi")
    @classmethod
    def strip_username(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Kullanıcı adı en az 2 karakter olmalıdır.")
        return cleaned


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


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=10)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @model_validator(mode="before")
    @classmethod
    def accept_eposta_alias(cls, data):
        if isinstance(data, dict) and "email" not in data and "eposta" in data:
            return {**data, "email": data["eposta"]}
        return data


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)

    @model_validator(mode="before")
    @classmethod
    def normalize_inputs(cls, data):
        if isinstance(data, dict):
            updated = dict(data)
            if "email" not in updated and "eposta" in updated:
                updated["email"] = updated["eposta"]
            if "code" in updated and isinstance(updated["code"], str):
                updated["code"] = updated["code"].strip()
            return updated
        return data

    @field_validator("code")
    @classmethod
    def validate_six_digit_code(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Sıfırlama kodu 6 haneli sayı olmalıdır.")
        return v