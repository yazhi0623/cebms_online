"""add user token version

Revision ID: 20260325_0008
Revises: 20260325_0007
Create Date: 2026-03-25 22:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260325_0008"
down_revision = "20260325_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("users", "token_version", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "token_version")
