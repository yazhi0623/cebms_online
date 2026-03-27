"""add templates table

Revision ID: 20260314_0002
Revises: 20260313_0001
Create Date: 2026-03-14 11:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260314_0002"
down_revision: Union[str, Sequence[str], None] = "20260313_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_templates_id", "templates", ["id"], unique=False)
    op.create_index("ix_templates_user_id", "templates", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_templates_user_id", table_name="templates")
    op.drop_index("ix_templates_id", table_name="templates")
    op.drop_table("templates")
