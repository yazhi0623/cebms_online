from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.job import JobStatus


class AnalysisTaskCreate(BaseModel):
    """创建分析后台任务时需要的参数。"""

    record_id: int | None = None
    template_id: int | None = None
    range_months: int = 0


class AnalysisTaskRead(BaseModel):
    """分析后台任务返回给前端的完整结构。"""

    id: int
    user_id: int
    record_id: int | None
    template_id: int | None
    range_months: int
    status: JobStatus
    result_analysis_id: int | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
