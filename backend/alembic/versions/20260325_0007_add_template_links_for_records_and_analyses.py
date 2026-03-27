"""add template links for records and analyses

Revision ID: 20260325_0007
Revises: 20260319_0006
Create Date: 2026-03-25 15:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260325_0007"
down_revision = "20260319_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("records", sa.Column("template_id", sa.Integer(), nullable=True))
    op.add_column("analyses", sa.Column("template_id", sa.Integer(), nullable=True))

    op.create_index("ix_records_template_id", "records", ["template_id"], unique=False)
    op.create_index("ix_analyses_template_id", "analyses", ["template_id"], unique=False)

    op.create_foreign_key(
        "fk_records_template_id_templates",
        "records",
        "templates",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_analyses_template_id_templates",
        "analyses",
        "templates",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_analyses_template_id_templates", "analyses", type_="foreignkey")
    op.drop_constraint("fk_records_template_id_templates", "records", type_="foreignkey")
    op.drop_index("ix_analyses_template_id", table_name="analyses")
    op.drop_index("ix_records_template_id", table_name="records")
    op.drop_column("analyses", "template_id")
    op.drop_column("records", "template_id")
