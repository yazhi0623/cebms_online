"""add template default flag

Revision ID: 20260314_0003
Revises: 20260314_0002
Create Date: 2026-03-14 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260314_0003"
down_revision: Union[str, Sequence[str], None] = "20260314_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column("templates", "is_default")
