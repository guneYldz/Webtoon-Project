"""phase 2 UNLOGGED view_dedupe table for multi-worker view deduplication

Revision ID: 003_phase2_view_dedupe
Revises: 002_seo_sitemap_indexes
Create Date: 2026-11-25
"""
from typing import Sequence, Union
from alembic import op

revision: str = "003_phase2_view_dedupe"
down_revision: Union[str, Sequence[str], None] = "002_seo_sitemap_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNLOGGED TABLE IF NOT EXISTS view_dedupe (
            dedupe_key VARCHAR(160) PRIMARY KEY,
            expires_at TIMESTAMPTZ NOT NULL
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_view_dedupe_expires_at ON view_dedupe (expires_at);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_view_dedupe_expires_at;")
    op.execute("DROP TABLE IF EXISTS view_dedupe;")
