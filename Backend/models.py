from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, Enum, Boolean, Float, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum

# --- İÇERİK TÜRÜ ENUM ---
class ContentType(str, enum.Enum):
    WEBTOON = "WEBTOON"
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
    google_id = Column(String(255), nullable=True, index=True)
    token_version = Column(Integer, nullable=False, default=1, server_default="1")

    comments = relationship("Comment", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    likes = relationship("Like", back_populates="user")
    reactions = relationship("ChapterReaction", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    password_reset_codes = relationship("PasswordResetCode", back_populates="user", cascade="all, delete-orphan")
    reading_progress = relationship("UserReadingProgress", back_populates="user", cascade="all, delete-orphan")

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

    novels = relationship(
        "Novel",
        secondary="novel_categories",
        back_populates="categories",
        overlaps="novel_links,category_novel_links",
    )

    novel_links = relationship(
        "NovelCategory",
        back_populates="category",
        overlaps="novels,categories",
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

    type = Column(Enum(ContentType), default=ContentType.WEBTOON)
    source_url = Column(String(500), nullable=True)
    rating_avg = Column(Float, nullable=False, default=0.0, server_default="0")
    rating_count = Column(Integer, nullable=False, default=0, server_default="0")
    translation_glossary = Column(Text, nullable=True)

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
    webtoon_id = Column(Integer, ForeignKey("webtoons.id", ondelete="CASCADE"), nullable=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Yanıt sistemi: bu yorum başka bir yorumun cevabıysa onun id'si
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    
    content = Column(Text, nullable=False)
    is_spoiler = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="comments")
    novel_chapter = relationship("NovelChapter", back_populates="comments")
    webtoon_episode = relationship("WebtoonEpisode", back_populates="comments")
    webtoon = relationship("Webtoon")
    novel = relationship("Novel")
    likes = relationship("CommentLike", back_populates="comment", cascade="all, delete-orphan")
    reports = relationship("CommentReport", back_populates="comment", cascade="all, delete-orphan")

    def __str__(self):
        return f"Yorum ({self.id}) - {self.content[:20]}..."


# 7.1 YORUM BEĞENİLERİ VE ŞİKAYETLERİ
class CommentLike(Base):
    __tablename__ = "comment_likes"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    comment = relationship("Comment", back_populates="likes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_like_user"),
    )


class CommentReport(Base):
    __tablename__ = "comment_reports"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(200), nullable=False, default="Diğer")
    status = Column(String(20), nullable=False, default="open", server_default="open")  # open | dismissed
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    comment = relationship("Comment", back_populates="reports")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_report_user"),
        Index("ix_comment_reports_status_comment", "status", "comment_id"),
    )

# 7.5 BİLDİRİMLER
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(30), nullable=False)  # "reply" | "announcement"
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="notifications")

    def __str__(self):
        return f"Bildirim ({self.id}) → User {self.user_id}: {self.title}"

# 7.6 DUYURULAR (herkese açık kanal sayfası)
class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    image = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    author = relationship("User")

    def __str__(self):
        return f"Duyuru ({self.id}): {self.title}"

# 8. FAVORİLER
class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True) 
    user_id = Column(Integer, ForeignKey("users.id"))
    
    webtoon_id = Column(Integer, ForeignKey("webtoons.id"), nullable=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=True)
    
    status = Column(String(20), nullable=False, default="reading", server_default="reading")
    notify_new_chapters = Column(Boolean, nullable=False, default=True, server_default="true")
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    webtoon = relationship("Webtoon", back_populates="favorites")
    novel = relationship("Novel", back_populates="favorites")

    def __str__(self):
        return f"Favorite: User {self.user_id}"


# 8.5 ÇAPRAZ CİHAZ OKUMA İLERLEMESİ (UserReadingProgress)
class UserReadingProgress(Base):
    __tablename__ = "user_reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String(16), nullable=False)  # webtoon | novel
    series_type = Column(String(16), nullable=False, default="WEBTOON")  # WEBTOON | MANGA | NOVEL
    series_id = Column(Integer, nullable=False)
    slug = Column(String(255), nullable=False, default="")
    title = Column(String(255), nullable=False, default="")
    cover_image = Column(String(500), nullable=True, default="")
    last_chapter_id = Column(Integer, nullable=True)
    last_chapter_number = Column(Float, nullable=True)
    last_chapter_title = Column(String(255), nullable=True)
    last_chapter_url = Column(String(500), nullable=False, default="")
    scroll_pct = Column(Integer, nullable=False, default=0)
    read_chapter_ids = Column(JSON, nullable=False, default=list)
    updated_at_ms = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reading_progress")

    __table_args__ = (
        UniqueConstraint("user_id", "content_type", "series_id", name="uq_user_reading_progress"),
        Index("ix_user_reading_progress_user_updated", "user_id", "updated_at_ms"),
    )

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
    view_count = Column(Integer, default=0)
    rating_avg = Column(Float, nullable=False, default=0.0, server_default="0")
    rating_count = Column(Integer, nullable=False, default=0, server_default="0")
    translation_glossary = Column(Text, nullable=True)
    favorites = relationship("Favorite", back_populates="novel")
    chapters = relationship("NovelChapter", back_populates="novel", cascade="all, delete-orphan")
    banner_image = Column(String, nullable=True)

    categories = relationship(
        "Category",
        secondary="novel_categories",
        back_populates="novels",
        overlaps="novel_links,category_novel_links",
    )
    category_links = relationship(
        "NovelCategory",
        back_populates="novel",
        overlaps="categories,novels",
    )

    def __str__(self):
        return self.title


class NovelCategory(Base):
    __tablename__ = "novel_categories"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    novel = relationship(
        "Novel",
        back_populates="category_links",
        overlaps="categories,novels",
    )
    category = relationship(
        "Category",
        back_populates="novel_links",
        overlaps="novels,categories",
    )

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


# 11. BÖLÜM TEPKİLERİ (webtoon bölümü veya novel bölümü)
class ChapterReaction(Base):
    __tablename__ = "chapter_reactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content_type = Column(String(20), nullable=False)  # webtoon | novel
    target_id = Column(Integer, nullable=False)
    reaction = Column(String(20), nullable=False)  # upvote, funny, love, surprised, angry, sad
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="reactions")

    __table_args__ = (
        UniqueConstraint("user_id", "content_type", "target_id", name="uq_user_chapter_reaction"),
        Index("ix_reactions_target", "content_type", "target_id"),
    )

    def __str__(self):
        return f"Reaction {self.reaction} by {self.user_id} on {self.content_type}:{self.target_id}"


# 12. YENİLEME TOKENLARI (HttpOnly Rotating Refresh Tokens)
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")


# 13. ŞİFRE SIFIRLAMA KODLARI (6 Haneli Tek Kullanımlık Kodlar)
class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="password_reset_codes")


# 14. SERİ PUANLAMALARI (1-5 Yıldız)
class SeriesRating(Base):
    __tablename__ = "series_ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String(16), nullable=False)  # webtoon | novel
    series_id = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)  # 1..5
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "content_type", "series_id", name="uq_user_series_rating"),
        Index("ix_series_ratings_target", "content_type", "series_id"),
    )


# 15. ANASAYFA CANLI SOHBET MESAJLARI
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String(300), nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

    __table_args__ = (
        Index("ix_chat_messages_deleted_id", "is_deleted", "id"),
        Index("ix_chat_messages_user_created", "user_id", "created_at"),
    )