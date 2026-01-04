from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship # <--- BU ÇOK ÖNEMLİ
from database import Base
import datetime

# 1. KULLANICILAR
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(String(10), default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # İLİŞKİLER (Python buradan verilere zıplayabilsin diye)
    comments = relationship("Comment", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")

# 2. KATEGORİLER
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    
    # Kategori -> Webtoon ilişkisi
    webtoon_links = relationship("WebtoonCategory", back_populates="category")

# 3. WEBTOONLAR
class Webtoon(Base):
    __tablename__ = "webtoons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=False)
    status = Column(String(30), default="ongoing")
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # İLİŞKİLER
    episodes = relationship("Episode", back_populates="webtoon") # Webtoon'dan bölümlere git
    category_links = relationship("WebtoonCategory", back_populates="webtoon")
    favorites = relationship("Favorite", back_populates="webtoon")

# 4. WEBTOON-KATEGORİ (ARA TABLO)
class WebtoonCategory(Base):
    __tablename__ = "webtoon_categories"

    id = Column(Integer, primary_key=True, index=True) 
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    # İLİŞKİLER
    webtoon = relationship("Webtoon", back_populates="category_links")
    category = relationship("Category", back_populates="webtoon_links")

# 5. BÖLÜMLER
class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    episode_number = Column(String(200), nullable=False) 
    view_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # İLİŞKİLER
    webtoon = relationship("Webtoon", back_populates="episodes") # Bölümden Webtoon'a geri dön (Babası kim?)
    images = relationship("EpisodeImage", back_populates="episode") # Bölümden Resimlere git
    comments = relationship("Comment", back_populates="episode")    # Bölümden Yorumlara git

# 6. BÖLÜM RESİMLERİ
class EpisodeImage(Base):
    __tablename__ = "episode_images"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=False)
    image_url = Column(String(500), nullable=False) 
    page_order = Column(Integer, nullable=False)

    # İLİŞKİLER
    episode = relationship("Episode", back_populates="images") # Resimden Bölüme geri dön

# 7. YORUMLAR
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    # DİKKAT: users_id yerine standart olarak user_id yaptım.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)       
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=True)   
    content = Column(Text, nullable=False)                                  
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # İLİŞKİLER
    user = relationship("User", back_populates="comments")      # Yorumu kim yazdı?
    episode = relationship("Episode", back_populates="comments") # Hangi bölüme yazdı?

# 8. FAVORİLER
class Favorite(Base):
    __tablename__ = "favorites"
    
    # Burada Composite Primary Key (İkili Anahtar) kullanmak en doğrusudur.
    # Yani bir kullanıcı aynı seriyi iki kere favorileyemesin diye.
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), primary_key=True)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

#9. BEĞENİLER 
class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))

    
    user = relationship("User", back_populates="likes")
    episode = relationship("Episode", back_populates="likes")

    # İLİŞKİLER
    user = relationship("User", back_populates="favorites")
    webtoon = relationship("Webtoon", back_populates="favorites")
    user = relationship("User", back_populates="likes")
    episode = relationship("Episode", back_populates="likes")