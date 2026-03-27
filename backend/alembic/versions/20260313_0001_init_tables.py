"""init tables

Revision ID: 20260313_0001
Revises:
Create Date: 2026-03-13 19:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260313_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_records_id", "records", ["id"], unique=False)
    op.create_index("ix_records_user_id", "records", ["user_id"], unique=False)

    op.create_table(
        "analyses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("day_key", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["record_id"], ["records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_analyses_id", "analyses", ["id"], unique=False)
    op.create_index("ix_analyses_record_id", "analyses", ["record_id"], unique=False)
    op.create_index("ix_analyses_user_id", "analyses", ["user_id"], unique=False)
    op.create_index("ix_analyses_day_key", "analyses", ["day_key"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_analyses_day_key", table_name="analyses")
    op.drop_index("ix_analyses_user_id", table_name="analyses")
    op.drop_index("ix_analyses_record_id", table_name="analyses")
    op.drop_index("ix_analyses_id", table_name="analyses")
    op.drop_table("analyses")

    op.drop_index("ix_records_user_id", table_name="records")
    op.drop_index("ix_records_id", table_name="records")
    op.drop_table("records")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
