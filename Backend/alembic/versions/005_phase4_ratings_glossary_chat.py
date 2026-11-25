"""phase 4 ratings, translation glossary, and live home chat

Revision ID: 005_phase4_ratings_glossary_chat
Revises: 004_phase3_retention_community
Create Date: 2026-11-25
"""
from typing import Sequence, Union
from alembic import op

revision: str = "005_phase4_ratings_glossary_chat"
down_revision: Union[str, Sequence[str], None] = "004_phase3_retention_community"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Series ratings aggregate & bot translation glossary on webtoons & novels
    op.execute(
        "ALTER TABLE webtoons ADD COLUMN IF NOT EXISTS rating_avg DOUBLE PRECISION NOT NULL DEFAULT 0;"
    )
    op.execute(
        "ALTER TABLE webtoons ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;"
    )
    op.execute(
        "ALTER TABLE webtoons ADD COLUMN IF NOT EXISTS translation_glossary TEXT NULL;"
    )

    op.execute(
        "ALTER TABLE novels ADD COLUMN IF NOT EXISTS rating_avg DOUBLE PRECISION NOT NULL DEFAULT 0;"
    )
    op.execute(
        "ALTER TABLE novels ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;"
    )
    op.execute(
        "ALTER TABLE novels ADD COLUMN IF NOT EXISTS translation_glossary TEXT NULL;"
    )

    # 2) User 1-5 star ratings table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS series_ratings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content_type VARCHAR(16) NOT NULL,
            series_id INTEGER NOT NULL,
            score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            CONSTRAINT uq_user_series_rating UNIQUE (user_id, content_type, series_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_series_ratings_user_id ON series_ratings (user_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_series_ratings_target ON series_ratings (content_type, series_id);"
    )

    # 3) Multi-worker live home chat table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content VARCHAR(300) NOT NULL,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_user_id ON chat_messages (user_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_deleted_id ON chat_messages (is_deleted, id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_user_created ON chat_messages (user_id, created_at DESC);"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_messages;")
    op.execute("DROP TABLE IF EXISTS series_ratings;")
    op.execute("ALTER TABLE novels DROP COLUMN IF EXISTS translation_glossary;")
    op.execute("ALTER TABLE novels DROP COLUMN IF EXISTS rating_count;")
    op.execute("ALTER TABLE novels DROP COLUMN IF EXISTS rating_avg;")
    op.execute("ALTER TABLE webtoons DROP COLUMN IF EXISTS translation_glossary;")
    op.execute("ALTER TABLE webtoons DROP COLUMN IF EXISTS rating_count;")
    op.execute("ALTER TABLE webtoons DROP COLUMN IF EXISTS rating_avg;")
