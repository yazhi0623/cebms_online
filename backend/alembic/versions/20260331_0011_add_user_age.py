"""add user age

Revision ID: 20260331_0011
Revises: 20260331_0010
Create Date: 2026-03-31 01:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0011"
down_revision = "20260331_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("age", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "age")
