from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.job import JobStatus

BackupFormat = Literal["zip"]


class BackupCreate(BaseModel):
    """创建备份任务时的参数。当前只支持 zip。"""

    format: BackupFormat = "zip"


class BackupRead(BaseModel):
    """备份任务返回给前端的完整结构。"""

    id: int
    user_id: int
    format: BackupFormat
    status: JobStatus
    storage_path: str | None
    checksum: str | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class BackupRestoreRead(BaseModel):
    """恢复备份后返回的导入统计。"""

    records_imported: int
    templates_imported: int
    analyses_imported: int
