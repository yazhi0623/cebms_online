from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict

# 分析结果支持的来源类型。
AnalysisType = Literal["single", "batch_chunk", "batch_summary"]


class AnalysisCreate(BaseModel):
    """手动创建分析结果时使用的请求体。"""

    record_id: int | None = None
    template_id: int | None = None
    analysis_type: AnalysisType = "single"
    content: str
    day_key: date


class AnalysisGenerateRequest(BaseModel):
    """请求系统自动生成分析时需要的参数。"""

    record_id: int | None = None
    template_id: int | None = None
    range_months: int = 0


class AnalysisRead(BaseModel):
    """分析结果返回给前端的完整结构。"""

    id: int
    user_id: int
    record_id: int | None
    template_id: int | None
    analysis_type: AnalysisType
    content: str
    day_key: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
