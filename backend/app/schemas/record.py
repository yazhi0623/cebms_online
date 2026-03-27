from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RecordCreate(BaseModel):
    """创建记录时的请求体。"""

    title: str
    content: str
    template_id: int | None = None


class RecordUpdate(BaseModel):
    """更新记录时的请求体。"""

    title: str
    content: str
    template_id: int | None = None


class RecordRead(BaseModel):
    """记录返回给前端的完整结构。"""

    id: int
    user_id: int
    template_id: int | None
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
