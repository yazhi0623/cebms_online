"""add user profile fields

Revision ID: 20260331_0010
Revises: 20260331_0009
Create Date: 2026-03-31 00:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0010"
down_revision = "20260331_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "email")
    op.drop_column("users", "phone")
    op.drop_column("users", "gender")
