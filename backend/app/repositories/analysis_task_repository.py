from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis_task import AnalysisTask


class AnalysisTaskRepository:
    """封装分析后台任务的数据库读写。"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        user_id: int,
        *,
        record_id: int | None,
        template_id: int | None,
        range_months: int,
    ) -> AnalysisTask:
        task = AnalysisTask(
            user_id=user_id,
            record_id=record_id,
            template_id=template_id,
            range_months=range_months,
            status="pending",
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_by_id(self, task_id: int) -> AnalysisTask | None:
        statement = select(AnalysisTask).where(AnalysisTask.id == task_id)
        return self.db.scalar(statement)

    def get_by_id_for_user(self, task_id: int, user_id: int) -> AnalysisTask | None:
        statement = select(AnalysisTask).where(
            AnalysisTask.id == task_id,
            AnalysisTask.user_id == user_id,
        )
        return self.db.scalar(statement)

    def mark_running(self, task: AnalysisTask) -> AnalysisTask:
        task.status = "running"
        task.error_message = None
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_success(self, task: AnalysisTask, result_analysis_id: int) -> AnalysisTask:
        task.status = "success"
        task.result_analysis_id = result_analysis_id
        task.error_message = None
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def mark_failed(self, task: AnalysisTask, error_message: str) -> AnalysisTask:
        task.status = "failed"
        task.error_message = error_message
        task.finished_at = datetime.now(UTC)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
