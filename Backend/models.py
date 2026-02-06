from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float
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

    def __str__(self):
        return self.username

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

    def __str__(self):
        return self.name

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
    is_published = Column(Boolean, default=False)
    banner_image = Column(String, nullable=True)
    
    # 👇 DÜZELTME BURADA: SQL Server hatasını önlemek için String(255) yapıldı
    slug = Column(String(255), unique=True, index=True)

    type = Column(Enum(ContentType), default=ContentType.MANGA)
    source_url = Column(String(500), nullable=True)

    categories = relationship(
        "Category", 
        secondary="webtoon_categories", 
        back_populates="webtoons", 
        overlaps="category_links,webtoon_links"
    )

    episodes = relationship("WebtoonEpisode", back_populates="webtoon", cascade="all, delete-orphan")
    
    category_links = relationship(
        "WebtoonCategory", 
        back_populates="webtoon", 
        overlaps="categories,webtoons"
    )
    
    favorites = relationship("Favorite", back_populates="webtoon")

    def __str__(self):
        return self.title

# 4. WEBTOON-KATEGORİ ARA TABLOSU
class WebtoonCategory(Base):
    __tablename__ = "webtoon_categories"

    id = Column(Integer, primary_key=True, index=True) 
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

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

# 5. BÖLÜMLER (WebtoonEpisode)
class WebtoonEpisode(Base):
    __tablename__ = "webtoon_episodes" 

    id = Column(Integer, primary_key=True, index=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    episode_number = Column(Float, nullable=False) 
    view_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    content_text = Column(Text, nullable=True)

    webtoon = relationship("Webtoon", back_populates="episodes")
    images = relationship("EpisodeImage", back_populates="episode", cascade="all, delete-orphan")
    
    comments = relationship("Comment", back_populates="webtoon_episode")
    likes = relationship("Like", back_populates="episode")

    def __str__(self):
        return f"{self.title} (Bölüm {self.episode_number})"

# 6. BÖLÜM RESİMLERİ
class EpisodeImage(Base):
    __tablename__ = "episode_images"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("webtoon_episodes.id"), nullable=False)
    image_url = Column(String(500), nullable=False) 
    page_order = Column(Integer, nullable=False)

    episode = relationship("WebtoonEpisode", back_populates="images")

    def __str__(self):
        return f"Image {self.page_order} for Episode {self.episode_id}"

# 7. YORUMLAR
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    novel_chapter_id = Column(Integer, ForeignKey("novel_chapters.id"), nullable=True) 
    webtoon_episode_id = Column(Integer, ForeignKey("webtoon_episodes.id"), nullable=True) 
    
    content = Column(Text, nullable=False)                              
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="comments")
    novel_chapter = relationship("NovelChapter", back_populates="comments")
    webtoon_episode = relationship("WebtoonEpisode", back_populates="comments")

    def __str__(self):
        return f"Yorum ({self.id}) - {self.content[:20]}..."

# 8. FAVORİLER
class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True) 
    user_id = Column(Integer, ForeignKey("users.id"))
    
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=True)
    
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    webtoon = relationship("Webtoon", back_populates="favorites")
    novel = relationship("Novel", back_populates="favorites")

    def __str__(self):
        return f"Favorite: User {self.user_id}"

# 9. BEĞENİLER
class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("webtoon_episodes.id"))

    user = relationship("User", back_populates="likes")
    episode = relationship("WebtoonEpisode", back_populates="likes")

    def __str__(self):
        return f"Like: User {self.user_id} - Episode {self.episode_id}"

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
    source_url = Column(String(500), nullable=True) 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_featured = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    favorites = relationship("Favorite", back_populates="novel")
    chapters = relationship("NovelChapter", back_populates="novel", cascade="all, delete-orphan")
    banner_image = Column(String, nullable=True)

    def __str__(self):
        return self.title

class NovelChapter(Base):
    __tablename__ = "novel_chapters"

    id = Column(Integer, primary_key=True, index=True)
    chapter_number = Column(Float) # Float yaptım ki 1.5 gibi ara bölümler olabilsin
    title = Column(String)                  
    content = Column(Text)                  
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # 👇 İŞTE EKSİK OLAN SÜTUN BUYDU!
    view_count = Column(Integer, default=0) 

    novel_id = Column(Integer, ForeignKey("novels.id"))
    novel = relationship("Novel", back_populates="chapters")
    
    # Novel ile ilişkili yorumları bağladık (Eğer Comment modelin varsa)
    comments = relationship("Comment", back_populates="novel_chapter")

    def __str__(self):
        return f"{self.title} (Bölüm {self.chapter_number})"