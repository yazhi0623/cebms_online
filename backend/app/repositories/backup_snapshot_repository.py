from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.backup_snapshot import BackupSnapshot


class BackupSnapshotRepository:
    """封装备份任务的数据库读写。"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[BackupSnapshot]:
        """按时间倒序列出某个用户的备份任务。"""
        statement = (
            select(BackupSnapshot)
            .where(BackupSnapshot.user_id == user_id)
            .order_by(BackupSnapshot.created_at.desc(), BackupSnapshot.id.desc())
        )
        return list(self.db.scalars(statement).all())

    def create(self, user_id: int, format: str) -> BackupSnapshot:
        """创建一个待执行的备份任务。"""
        snapshot = BackupSnapshot(user_id=user_id, format=format, status="pending")
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def get_by_id_for_user(self, snapshot_id: int, user_id: int) -> BackupSnapshot | None:
        """读取某个用户自己的备份任务。"""
        statement = select(BackupSnapshot).where(
            BackupSnapshot.id == snapshot_id,
            BackupSnapshot.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_id(self, snapshot_id: int) -> BackupSnapshot | None:
        """按主键读取备份任务，供后台执行器使用。"""
        statement = select(BackupSnapshot).where(BackupSnapshot.id == snapshot_id)
        return self.db.scalar(statement)

    def delete(self, snapshot: BackupSnapshot) -> None:
        """删除备份任务记录。"""
        self.db.delete(snapshot)
        self.db.commit()

    def mark_running(self, snapshot: BackupSnapshot) -> BackupSnapshot:
        """把任务状态更新为运行中。"""
        snapshot.status = "running"
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def mark_success(self, snapshot: BackupSnapshot, storage_path: str, checksum: str) -> BackupSnapshot:
        """在备份完成后写入文件路径和校验和。"""
        snapshot.status = "success"
        snapshot.storage_path = storage_path
        snapshot.checksum = checksum
        snapshot.finished_at = datetime.now(UTC)
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def mark_failed(self, snapshot: BackupSnapshot) -> BackupSnapshot:
        """标记备份任务失败。"""
        snapshot.status = "failed"
        snapshot.finished_at = datetime.now(UTC)
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot
