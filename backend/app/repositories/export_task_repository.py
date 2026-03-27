from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.export_task import ExportTask


class ExportTaskRepository:
    """封装导出任务的数据库读写。"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[ExportTask]:
        """按时间倒序列出某个用户的导出任务。"""
        statement = (
            select(ExportTask)
            .where(ExportTask.user_id == user_id)
            .order_by(ExportTask.created_at.desc(), ExportTask.id.desc())
        )
        return list(self.db.scalars(statement).all())

    def create(self, user_id: int, export_type: str, format: str) -> ExportTask:
        """创建一个待执行的导出任务。"""
        task = ExportTask(user_id=user_id, export_type=export_type, format=format, status="pending")
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_by_id_for_user(self, task_id: int, user_id: int) -> ExportTask | None:
        """读取某个用户自己的导出任务。"""
        statement = select(ExportTask).where(
            ExportTask.id == task_id,
            ExportTask.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_id(self, task_id: int) -> ExportTask | None:
        """按主键读取导出任务，供后台执行器使用。"""
        statement = select(ExportTask).where(ExportTask.id == task_id)
        return self.db.scalar(statement)

    def delete(self, task: ExportTask) -> None:
        """删除导出任务记录。"""
        self.db.delete(task)
        self.db.commit()

    def mark_running(self, task: ExportTask) -> ExportTask:
        """把任务状态更新为运行中。"""
        task.status = "running"
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_success(self, task: ExportTask, file_path: str, file_size: int, expires_at: datetime | None) -> ExportTask:
        """在导出完成后写回文件元数据。"""
        task.status = "success"
        task.file_path = file_path
        task.file_size = file_size
        task.expires_at = expires_at
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_failed(self, task: ExportTask) -> ExportTask:
        """标记导出任务失败。"""
        task.status = "failed"
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
