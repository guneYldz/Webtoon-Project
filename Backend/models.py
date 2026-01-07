from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum

# --- YENİ EKLENEN: İÇERİK TÜRÜ ENUM ---
# Veritabanında standart sağlamak için (Sadece 'MANGA' veya 'NOVEL' girilebilir)
class ContentType(str, enum.Enum):
    MANGA = "MANGA"
    NOVEL = "NOVEL"

# 1. KULLANICILAR (Değişiklik Yok)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(String(10), default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # İLİŞKİLER
    comments = relationship("Comment", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    likes = relationship("Like", back_populates="user")

# 2. KATEGORİLER (Değişiklik Yok)
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    
    webtoon_links = relationship("WebtoonCategory", back_populates="category")

# 3. WEBTOONLAR (ARTIK SERİLER) - GÜNCELLENDİ ✅
class Webtoon(Base):
    __tablename__ = "webtoons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=False)
    status = Column(String(30), default="ongoing")
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # --- YENİ EKLENEN ALANLAR ---
    # 1. Tür: Bu bir Manga mı yoksa Novel mı?
    type = Column(Enum(ContentType), default=ContentType.MANGA)
    
    # 2. Kaynak Link: Bot bu seriyi hangi siteden takip edecek? (Otomasyon için şart)
    source_url = Column(String(500), nullable=True)

    # İLİŞKİLER
    episodes = relationship("Episode", back_populates="webtoon")
    category_links = relationship("WebtoonCategory", back_populates="webtoon")
    favorites = relationship("Favorite", back_populates="webtoon")

# 4. WEBTOON-KATEGORİ (Değişiklik Yok)
class WebtoonCategory(Base):
    __tablename__ = "webtoon_categories"

    id = Column(Integer, primary_key=True, index=True) 
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    webtoon = relationship("Webtoon", back_populates="category_links")
    category = relationship("Category", back_populates="webtoon_links")

# 5. BÖLÜMLER - GÜNCELLENDİ ✅
class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    episode_number = Column(Integer, nullable=False) 
    view_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # --- YENİ EKLENEN ALAN ---
    # Eğer bu bir Novel bölümü ise, metin burada tutulacak.
    # Manga ise burası NULL (boş) kalacak.
    content_text = Column(Text, nullable=True)

    # İLİŞKİLER
    webtoon = relationship("Webtoon", back_populates="episodes")
    images = relationship("EpisodeImage", back_populates="episode")
    comments = relationship("Comment", back_populates="episode")
    likes = relationship("Like", back_populates="episode")

# 6. BÖLÜM RESİMLERİ (Değişiklik Yok - Sadece Mangalar kullanacak)
class EpisodeImage(Base):
    __tablename__ = "episode_images"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=False)
    image_url = Column(String(500), nullable=False) 
    page_order = Column(Integer, nullable=False)

    episode = relationship("Episode", back_populates="images")

# 7. YORUMLAR (Değişiklik Yok)
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)       
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=True)   
    content = Column(Text, nullable=False)                                  
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="comments")
    episode = relationship("Episode", back_populates="comments")

# 8. FAVORİLER (Değişiklik Yok)
class Favorite(Base):
    __tablename__ = "favorites"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), primary_key=True)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    webtoon = relationship("Webtoon", back_populates="favorites")

# 9. BEĞENİLER (Değişiklik Yok)
class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))

    user = relationship("User", back_populates="likes")
    episode = relationship("Episode", back_populates="likes")