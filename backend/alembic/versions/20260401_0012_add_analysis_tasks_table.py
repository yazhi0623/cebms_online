"""add analysis tasks table

Revision ID: 20260401_0012
Revises: 20260331_0011
Create Date: 2026-04-01 10:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260401_0012"
down_revision = "20260331_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=True),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("range_months", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("result_analysis_id", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["record_id"], ["records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["result_analysis_id"], ["analyses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analysis_tasks_id"), "analysis_tasks", ["id"], unique=False)
    op.create_index(op.f("ix_analysis_tasks_record_id"), "analysis_tasks", ["record_id"], unique=False)
    op.create_index(op.f("ix_analysis_tasks_result_analysis_id"), "analysis_tasks", ["result_analysis_id"], unique=False)
    op.create_index(op.f("ix_analysis_tasks_status"), "analysis_tasks", ["status"], unique=False)
    op.create_index(op.f("ix_analysis_tasks_template_id"), "analysis_tasks", ["template_id"], unique=False)
    op.create_index(op.f("ix_analysis_tasks_user_id"), "analysis_tasks", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_analysis_tasks_user_id"), table_name="analysis_tasks")
    op.drop_index(op.f("ix_analysis_tasks_template_id"), table_name="analysis_tasks")
    op.drop_index(op.f("ix_analysis_tasks_status"), table_name="analysis_tasks")
    op.drop_index(op.f("ix_analysis_tasks_result_analysis_id"), table_name="analysis_tasks")
    op.drop_index(op.f("ix_analysis_tasks_record_id"), table_name="analysis_tasks")
    op.drop_index(op.f("ix_analysis_tasks_id"), table_name="analysis_tasks")
    op.drop_table("analysis_tasks")
