"""phase 1 schema hardening, auth tokens, deduplication, and indexes

Revision ID: 001_phase1_schema_and_indexes
Revises: None
Create Date: 2026-11-23
"""
from typing import Sequence, Union
from alembic import op

revision: str = "001_phase1_schema_and_indexes"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Legacy missing-column guards (replacing startup ALTER TABLE race blocks)
    op.execute("ALTER TABLE novels ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;")
    op.execute("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id);")
    op.execute("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image VARCHAR(500);")

    # 2) Phase 1 User columns
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;")

    # 3) Phase 1 Auth tables
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            revoked_at TIMESTAMP WITHOUT TIME ZONE NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            user_agent VARCHAR(255) NULL,
            ip_address VARCHAR(64) NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            code_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            used_at TIMESTAMP WITHOUT TIME ZONE NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        );
        """
    )

    # 4) Safe pre-constraint deduplication on live PostgreSQL data
    op.execute(
        """
        DELETE FROM favorites f
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY user_id, webtoon_id ORDER BY id ASC) AS rn
            FROM favorites
            WHERE user_id IS NOT NULL AND webtoon_id IS NOT NULL
        ) dup
        WHERE f.id = dup.id AND dup.rn > 1;
        """
    )
    op.execute(
        """
        DELETE FROM favorites f
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY user_id, novel_id ORDER BY id ASC) AS rn
            FROM favorites
            WHERE user_id IS NOT NULL AND novel_id IS NOT NULL
        ) dup
        WHERE f.id = dup.id AND dup.rn > 1;
        """
    )
    op.execute(
        """
        DELETE FROM likes l
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY user_id, episode_id ORDER BY id ASC) AS rn
            FROM likes
            WHERE user_id IS NOT NULL AND episode_id IS NOT NULL
        ) dup
        WHERE l.id = dup.id AND dup.rn > 1;
        """
    )
    op.execute(
        """
        WITH ranked_users AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY id ASC) AS rn
            FROM users
            WHERE username IS NOT NULL
        )
        UPDATE users u
        SET username = LEFT(u.username, GREATEST(1, 50 - LENGTH('_' || u.id::text))) || '_' || u.id::text
        FROM ranked_users r
        WHERE u.id = r.id AND r.rn > 1;
        """
    )

    # 5) Partial unique indexes & Phase 1 auth indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username));")

    op.execute("CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_token_hash ON refresh_tokens (token_hash);")

    op.execute("CREATE INDEX IF NOT EXISTS ix_password_reset_codes_user_id ON password_reset_codes (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_password_reset_codes_code_hash ON password_reset_codes (code_hash);")

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_user_webtoon ON favorites (user_id, webtoon_id) WHERE user_id IS NOT NULL AND webtoon_id IS NOT NULL;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_user_novel ON favorites (user_id, novel_id) WHERE user_id IS NOT NULL AND novel_id IS NOT NULL;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_user_episode ON likes (user_id, episode_id) WHERE user_id IS NOT NULL AND episode_id IS NOT NULL;")

    # 6) Foreign-key & hot query B-tree indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_webtoon_episodes_webtoon_ep_num ON webtoon_episodes (webtoon_id, episode_number);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_novel_chapters_novel_ch_num ON novel_chapters (novel_id, chapter_number);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_episode_images_episode_id ON episode_images (episode_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_webtoon_episode_id ON comments (webtoon_episode_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_novel_chapter_id ON comments (novel_chapter_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_user_id ON comments (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_parent_id ON comments (parent_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_favorites_user_id ON favorites (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_likes_user_id ON likes (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications (user_id, is_read, created_at);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reactions_target ON chapter_reactions (content_type, target_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_webtoon_categories_webtoon_id ON webtoon_categories (webtoon_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_webtoon_categories_category_id ON webtoon_categories (category_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_novel_categories_novel_id ON novel_categories (novel_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_novel_categories_category_id ON novel_categories (category_id);")


def downgrade() -> None:
    for idx in (
        "ix_novel_categories_category_id",
        "ix_novel_categories_novel_id",
        "ix_webtoon_categories_category_id",
        "ix_webtoon_categories_webtoon_id",
        "ix_reactions_target",
        "ix_notifications_user_read_created",
        "ix_likes_user_id",
        "ix_favorites_user_id",
        "ix_comments_parent_id",
        "ix_comments_user_id",
        "ix_comments_novel_chapter_id",
        "ix_comments_webtoon_episode_id",
        "ix_episode_images_episode_id",
        "ix_novel_chapters_novel_ch_num",
        "ix_webtoon_episodes_webtoon_ep_num",
        "uq_likes_user_episode",
        "uq_favorites_user_novel",
        "uq_favorites_user_webtoon",
        "uq_users_username_lower",
        "uq_users_google_id",
        "ix_users_google_id",
    ):
        op.execute(f"DROP INDEX IF EXISTS {idx};")

    op.execute("DROP TABLE IF EXISTS password_reset_codes;")
    op.execute("DROP TABLE IF EXISTS refresh_tokens;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS token_version;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS google_id;")
