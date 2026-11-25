"""phase 3 retention and community: reading progress, favorite statuses, comments v2

Revision ID: 004_phase3_retention_community
Revises: 003_phase2_view_dedupe
Create Date: 2026-11-25
"""
from typing import Sequence, Union
from alembic import op

revision: str = "004_phase3_retention_community"
down_revision: Union[str, Sequence[str], None] = "003_phase2_view_dedupe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Favorites library status + per-series notification mute
    op.execute(
        "ALTER TABLE favorites ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'reading';"
    )
    op.execute(
        "ALTER TABLE favorites ADD COLUMN IF NOT EXISTS notify_new_chapters BOOLEAN NOT NULL DEFAULT TRUE;"
    )

    # 2) Comments v2: series targets, spoiler flag, edit timestamp
    op.execute(
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS webtoon_id INTEGER REFERENCES webtoons(id) ON DELETE CASCADE;"
    )
    op.execute(
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE;"
    )
    op.execute(
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN NOT NULL DEFAULT FALSE;"
    )
    op.execute(
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NULL;"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_webtoon_id ON comments (webtoon_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_novel_id ON comments (novel_id);")

    # 3) Comment likes & reports
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS comment_likes (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            CONSTRAINT uq_comment_like_user UNIQUE (comment_id, user_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_comment_likes_comment_id ON comment_likes (comment_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comment_likes_user_id ON comment_likes (user_id);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS comment_reports (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason VARCHAR(200) NOT NULL DEFAULT 'Diğer',
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            CONSTRAINT uq_comment_report_user UNIQUE (comment_id, user_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_comment_reports_comment_id ON comment_reports (comment_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comment_reports_user_id ON comment_reports (user_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_comment_reports_status_comment ON comment_reports (status, comment_id);"
    )

    # 4) Cross-device reading progress sync
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_reading_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content_type VARCHAR(16) NOT NULL,
            series_type VARCHAR(16) NOT NULL DEFAULT 'WEBTOON',
            series_id INTEGER NOT NULL,
            slug VARCHAR(255) NOT NULL DEFAULT '',
            title VARCHAR(255) NOT NULL DEFAULT '',
            cover_image VARCHAR(500) NULL DEFAULT '',
            last_chapter_id INTEGER NULL,
            last_chapter_number DOUBLE PRECISION NULL,
            last_chapter_title VARCHAR(255) NULL,
            last_chapter_url VARCHAR(500) NOT NULL DEFAULT '',
            scroll_pct INTEGER NOT NULL DEFAULT 0,
            read_chapter_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            updated_at_ms BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            CONSTRAINT uq_user_reading_progress UNIQUE (user_id, content_type, series_id)
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_reading_progress_user_id ON user_reading_progress (user_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_reading_progress_user_updated ON user_reading_progress (user_id, updated_at_ms DESC);"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_reading_progress;")
    op.execute("DROP TABLE IF EXISTS comment_reports;")
    op.execute("DROP TABLE IF EXISTS comment_likes;")
    op.execute("DROP INDEX IF EXISTS ix_comments_novel_id;")
    op.execute("DROP INDEX IF EXISTS ix_comments_webtoon_id;")
    op.execute("ALTER TABLE comments DROP COLUMN IF EXISTS updated_at;")
    op.execute("ALTER TABLE comments DROP COLUMN IF EXISTS is_spoiler;")
    op.execute("ALTER TABLE comments DROP COLUMN IF EXISTS novel_id;")
    op.execute("ALTER TABLE comments DROP COLUMN IF EXISTS webtoon_id;")
    op.execute("ALTER TABLE favorites DROP COLUMN IF EXISTS notify_new_chapters;")
    op.execute("ALTER TABLE favorites DROP COLUMN IF EXISTS status;")
