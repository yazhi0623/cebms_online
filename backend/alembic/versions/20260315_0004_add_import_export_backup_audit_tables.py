"""add import export backup and audit tables

Revision ID: 20260315_0004
Revises: 20260314_0003
Create Date: 2026-03-15 16:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260315_0004"
down_revision: Union[str, Sequence[str], None] = "20260314_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("success_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_report_path", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_import_tasks_id", "import_tasks", ["id"], unique=False)
    op.create_index("ix_import_tasks_user_id", "import_tasks", ["user_id"], unique=False)
    op.create_index("ix_import_tasks_status", "import_tasks", ["status"], unique=False)

    op.create_table(
        "export_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("export_type", sa.String(length=30), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_export_tasks_id", "export_tasks", ["id"], unique=False)
    op.create_index("ix_export_tasks_user_id", "export_tasks", ["user_id"], unique=False)
    op.create_index("ix_export_tasks_status", "export_tasks", ["status"], unique=False)

    op.create_table(
        "backup_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("format", sa.String(length=20), server_default="zip", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_backup_snapshots_id", "backup_snapshots", ["id"], unique=False)
    op.create_index("ix_backup_snapshots_user_id", "backup_snapshots", ["user_id"], unique=False)
    op.create_index("ix_backup_snapshots_status", "backup_snapshots", ["status"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=50), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_backup_snapshots_status", table_name="backup_snapshots")
    op.drop_index("ix_backup_snapshots_user_id", table_name="backup_snapshots")
    op.drop_index("ix_backup_snapshots_id", table_name="backup_snapshots")
    op.drop_table("backup_snapshots")

    op.drop_index("ix_export_tasks_status", table_name="export_tasks")
    op.drop_index("ix_export_tasks_user_id", table_name="export_tasks")
    op.drop_index("ix_export_tasks_id", table_name="export_tasks")
    op.drop_table("export_tasks")

    op.drop_index("ix_import_tasks_status", table_name="import_tasks")
    op.drop_index("ix_import_tasks_user_id", table_name="import_tasks")
    op.drop_index("ix_import_tasks_id", table_name="import_tasks")
    op.drop_table("import_tasks")
