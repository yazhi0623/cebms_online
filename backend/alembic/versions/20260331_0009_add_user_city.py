"""add user city

Revision ID: 20260331_0009
Revises: 20260325_0008
Create Date: 2026-03-31 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0009"
down_revision = "20260325_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("city", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "city")
