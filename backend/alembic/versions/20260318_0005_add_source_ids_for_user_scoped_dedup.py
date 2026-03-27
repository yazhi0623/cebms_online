"""add source ids for user scoped dedup

Revision ID: 20260318_0005
Revises: 20260315_0004
Create Date: 2026-03-18 23:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260318_0005"
down_revision = "20260315_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("records", sa.Column("source_record_id", sa.Integer(), nullable=True))
    op.add_column("templates", sa.Column("source_template_id", sa.Integer(), nullable=True))
    op.add_column("analyses", sa.Column("source_analysis_id", sa.Integer(), nullable=True))

    op.create_index("ix_records_source_record_id", "records", ["source_record_id"], unique=False)
    op.create_index("ix_templates_source_template_id", "templates", ["source_template_id"], unique=False)
    op.create_index("ix_analyses_source_analysis_id", "analyses", ["source_analysis_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_analyses_source_analysis_id", table_name="analyses")
    op.drop_index("ix_templates_source_template_id", table_name="templates")
    op.drop_index("ix_records_source_record_id", table_name="records")

    op.drop_column("analyses", "source_analysis_id")
    op.drop_column("templates", "source_template_id")
    op.drop_column("records", "source_record_id")
