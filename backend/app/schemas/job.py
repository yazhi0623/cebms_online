from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

# 聚合任务允许出现的状态。
JobStatus = Literal["pending", "running", "success", "failed"]
# 聚合任务对前端暴露的类型标签。
JobType = Literal["record_import", "record_export", "analysis_export", "backup_export"]


class JobRead(BaseModel):
    """数据中心任务列表中的通用任务结构。"""

    id: int
    type: JobType
    status: JobStatus
    created_at: datetime
    updated_at: datetime


class JobDetailRead(JobRead):
    """预留给更详细的任务查询使用。"""

    model_config = ConfigDict(from_attributes=True)
