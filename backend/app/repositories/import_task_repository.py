from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.import_task import ImportTask


class ImportTaskRepository:
    """封装导入任务的数据库读写。"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[ImportTask]:
        """按时间倒序列出某个用户的导入任务。"""
        statement = (
            select(ImportTask)
            .where(ImportTask.user_id == user_id)
            .order_by(ImportTask.created_at.desc(), ImportTask.id.desc())
        )
        return list(self.db.scalars(statement).all())

    def create(self, user_id: int, source_type: str, file_name: str) -> ImportTask:
        """创建一个待执行的导入任务。"""
        task = ImportTask(user_id=user_id, source_type=source_type, file_name=file_name, status="pending")
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_by_id_for_user(self, task_id: int, user_id: int) -> ImportTask | None:
        """读取某个用户自己的导入任务。"""
        statement = select(ImportTask).where(
            ImportTask.id == task_id,
            ImportTask.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_id(self, task_id: int) -> ImportTask | None:
        """按主键读取导入任务，供后台执行器使用。"""
        statement = select(ImportTask).where(ImportTask.id == task_id)
        return self.db.scalar(statement)

    def delete(self, task: ImportTask) -> None:
        """删除导入任务记录。"""
        self.db.delete(task)
        self.db.commit()

    def mark_running(self, task: ImportTask) -> ImportTask:
        """把任务状态更新为运行中。"""
        task.status = "running"
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_success(self, task: ImportTask, total_count: int, success_count: int, failed_count: int) -> ImportTask:
        """在导入成功后写回统计数据。"""
        task.status = "success"
        task.total_count = total_count
        task.success_count = success_count
        task.failed_count = failed_count
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_failed(
        self,
        task: ImportTask,
        total_count: int,
        success_count: int,
        failed_count: int,
        error_report_path: str | None = None,
    ) -> ImportTask:
        """在导入失败后写回统计和错误报告路径。"""
        task.status = "failed"
        task.total_count = total_count
        task.success_count = success_count
        task.failed_count = failed_count
        task.error_report_path = error_report_path
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
