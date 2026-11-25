"""SEO sitemap partial/covering indexes for published series and chapters

Revision ID: 002_seo_sitemap_indexes
Revises: 001_phase1_schema_and_indexes
Create Date: 2026-11-25
"""
from typing import Sequence, Union
from alembic import op

revision: str = "002_seo_sitemap_indexes"
down_revision: Union[str, Sequence[str], None] = "001_phase1_schema_and_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE INDEX IF NOT EXISTS ix_novels_published ON novels (id) WHERE is_published = true;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_webtoons_published ON webtoons (id) WHERE is_published = true;")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_novel_chapters_pub_nav "
        "ON novel_chapters (novel_id, chapter_number) INCLUDE (created_at) "
        "WHERE is_published = true;"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_webtoon_episodes_pub_nav "
        "ON webtoon_episodes (webtoon_id, episode_number) INCLUDE (id, created_at) "
        "WHERE is_published = true;"
    )


def downgrade() -> None:
    for idx in (
        "ix_webtoon_episodes_pub_nav",
        "ix_novel_chapters_pub_nav",
        "ix_webtoons_published",
        "ix_novels_published",
    ):
        op.execute(f"DROP INDEX IF EXISTS {idx};")
