from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean 
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum

# --- İÇERİK TÜRÜ ENUM ---
class ContentType(str, enum.Enum):
    MANGA = "MANGA"
    NOVEL = "NOVEL"

# 1. KULLANICILAR
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(String(10), default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    profile_image = Column(String, nullable=True)
    

    comments = relationship("Comment", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    likes = relationship("Like", back_populates="user")

# 2. KATEGORİLER
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    
    webtoons = relationship(
        "Webtoon", 
        secondary="webtoon_categories", 
        back_populates="categories", 
        overlaps="webtoon_links,category_links" 
    )
    
    webtoon_links = relationship(
        "WebtoonCategory", 
        back_populates="category", 
        overlaps="webtoons,categories"
    )

    # 👇 BU KISMI EKLE (Panelde isimlerin düzgün görünmesi için)
    def __str__(self):
        return self.name
    
    webtoon_links = relationship(
        "WebtoonCategory", 
        back_populates="category", 
        overlaps="webtoons,categories"
    )

# 3. WEBTOONLAR
class Webtoon(Base):
    __tablename__ = "webtoons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    status = Column(String(30), default="ongoing")
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_featured = Column(Boolean, default=False)
    banner_image = Column(String, nullable=True)

    type = Column(Enum(ContentType), default=ContentType.MANGA)
    source_url = Column(String(500), nullable=True)

    # 👇 BURASI GÜNCELLENDİ: Hem kendi linklerini hem karşı tarafın linklerini overlaps'e ekledik
    categories = relationship(
        "Category", 
        secondary="webtoon_categories", 
        back_populates="webtoons", 
        overlaps="category_links,webtoon_links"
    )

    episodes = relationship("Episode", back_populates="webtoon")
    
    category_links = relationship(
        "WebtoonCategory", 
        back_populates="webtoon", 
        overlaps="categories,webtoons"
    )
    
    favorites = relationship("Favorite", back_populates="webtoon")

# 4. WEBTOON-KATEGORİ ARA TABLOSU
class WebtoonCategory(Base):
    __tablename__ = "webtoon_categories"

    id = Column(Integer, primary_key=True, index=True) 
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    # 👇 BURASI EKSİKTİ, EKLENDİ: Artık burası da üstteki ilişkileri tanıyor
    webtoon = relationship(
        "Webtoon", 
        back_populates="category_links", 
        overlaps="categories,webtoons"
    )
    
    category = relationship(
        "Category", 
        back_populates="webtoon_links", 
        overlaps="webtoons,categories"
    )

# 5. BÖLÜMLER
class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    episode_number = Column(Integer, nullable=False) 
    view_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    content_text = Column(Text, nullable=True)

    webtoon = relationship("Webtoon", back_populates="episodes")
    images = relationship("EpisodeImage", back_populates="episode")
    comments = relationship("Comment", back_populates="episode")
    likes = relationship("Like", back_populates="episode")

# 6. BÖLÜM RESİMLERİ
class EpisodeImage(Base):
    __tablename__ = "episode_images"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=False)
    image_url = Column(String(500), nullable=False) 
    page_order = Column(Integer, nullable=False)

    episode = relationship("Episode", back_populates="images")

# 7. YORUMLAR
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 👇 Hem Webtoon hem Novel desteği için ikisi de nullable (boş olabilir)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=True)   
    novel_chapter_id = Column(Integer, ForeignKey("novel_chapters.id"), nullable=True) 
    
    content = Column(Text, nullable=False)                                  
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
   

    user = relationship("User", back_populates="comments")
    episode = relationship("Episode", back_populates="comments")
    novel_chapter = relationship("NovelChapter", back_populates="comments")
# 8. FAVORİLER
class Favorite(Base):
    __tablename__ = "favorites"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), primary_key=True)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    webtoon = relationship("Webtoon", back_populates="favorites")

# 9. BEĞENİLER
class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))

    user = relationship("User", back_populates="likes")
    episode = relationship("Episode", back_populates="likes")

# 10. ROMANLAR
class Novel(Base):
    __tablename__ = "novels"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)      
    slug = Column(String(255), unique=True, index=True) 
    summary = Column(String)                
    cover_image = Column(String, nullable=True) 
    author = Column(String, nullable=True)  
    status = Column(String, default="ongoing") 
    
    # 👇 BURASI EKLENDİ!
    # Botun romanı hangi siteden takip edeceğini buraya yazacağız.
    source_url = Column(String(500), nullable=True) 
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    chapters = relationship("NovelChapter", back_populates="novel")
class NovelChapter(Base):
    __tablename__ = "novel_chapters"

    id = Column(Integer, primary_key=True, index=True)
    chapter_number = Column(Integer)        
    title = Column(String)                  
    content = Column(Text)                  
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    novel_id = Column(Integer, ForeignKey("novels.id"))
    novel = relationship("Novel", back_populates="chapters")

    comments = relationship("Comment", back_populates="novel_chapter")