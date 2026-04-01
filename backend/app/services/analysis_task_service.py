from fastapi import HTTPException, status

from app.models.analysis_task import AnalysisTask
from app.repositories.analysis_task_repository import AnalysisTaskRepository
from app.schemas.analysis_task import AnalysisTaskCreate


class AnalysisTaskService:
    """负责分析后台任务的创建和查询。"""

    def __init__(self, analysis_task_repository: AnalysisTaskRepository) -> None:
        self.analysis_task_repository = analysis_task_repository

    def create_task(self, user_id: int, payload: AnalysisTaskCreate) -> AnalysisTask:
        return self.analysis_task_repository.create(
            user_id,
            record_id=payload.record_id,
            template_id=payload.template_id,
            range_months=payload.range_months,
        )

    def get_task(self, task_id: int, user_id: int) -> AnalysisTask:
        task = self.analysis_task_repository.get_by_id_for_user(task_id, user_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis task not found")
        return task
