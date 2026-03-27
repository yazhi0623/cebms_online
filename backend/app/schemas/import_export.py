from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.job import JobStatus

# 导入时允许的请求类型。
ImportSourceType = Literal["json", "xlsx", "txt", "markdown"]
# 读取时额外兼容历史数据里的 csv。
ImportSourceTypeRead = Literal["json", "xlsx", "txt", "markdown", "csv"]
# 可导出的资源类型。
ExportType = Literal["records", "templates", "analyses"]
# 创建导出任务时允许的格式。
ExportFormat = Literal["json", "xlsx", "markdown", "txt"]
# 读取时额外兼容历史数据里的 csv。
ExportFormatRead = Literal["json", "xlsx", "markdown", "txt", "csv"]


class RecordImportCreate(BaseModel):
    """创建导入任务时需要的最小字段。"""

    source_type: ImportSourceType
    file_name: str


class RecordImportRead(BaseModel):
    """导入任务返回给前端的完整结构。"""

    id: int
    user_id: int
    source_type: ImportSourceTypeRead
    file_name: str
    status: JobStatus
    total_count: int
    success_count: int
    failed_count: int
    error_report_path: str | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RecordExportCreate(BaseModel):
    """创建导出任务时需要的参数。"""

    export_type: ExportType
    format: ExportFormat


class RecordExportRead(BaseModel):
    """导出任务返回给前端的完整结构。"""

    id: int
    user_id: int
    export_type: ExportType
    format: ExportFormatRead
    status: JobStatus
    file_path: str | None
    file_size: int | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None
    expires_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
