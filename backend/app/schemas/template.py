from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateCreate(BaseModel):
    """创建模板时的请求体。"""

    title: str
    content: str
    is_default: bool = False


class TemplateUpdate(BaseModel):
    """更新模板时的请求体。"""

    title: str
    content: str
    is_default: bool = False


class TemplateRead(BaseModel):
    """模板返回给前端的完整结构。"""

    id: int
    user_id: int
    title: str
    content: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
