"""add analysis type

Revision ID: 20260319_0006
Revises: 20260318_0005
Create Date: 2026-03-19 16:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260319_0006"
down_revision = "20260318_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("analysis_type", sa.String(length=32), nullable=False, server_default="single"),
    )

    op.execute(
        """
        UPDATE analyses
        SET analysis_type = CASE
            WHEN content LIKE '【分析范围】%（第%/%组）%' THEN 'batch_chunk'
            WHEN content LIKE '【分析范围】%（汇总）%' THEN 'batch_summary'
            ELSE 'single'
        END
        """
    )

    op.create_index("ix_analyses_analysis_type", "analyses", ["analysis_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_analyses_analysis_type", table_name="analyses")
    op.drop_column("analyses", "analysis_type")
