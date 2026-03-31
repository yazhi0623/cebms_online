from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


USERNAME_PATTERN = r"^[A-Za-z0-9_]{3,50}$"


class UserCreate(BaseModel):
    """注册时提交的用户信息。"""

    username: str = Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    """返回给前端的用户公开信息。"""

    id: int
    username: str
    gender: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    """用户可自行编辑的最小资料。"""

    username: str = Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    gender: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)


class UserProfileUpdateResult(BaseModel):
    user: UserRead
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserLogin(BaseModel):
    """登录时提交的用户名和密码。"""

    username: str = Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)


class RefreshTokenRequest(BaseModel):
    """刷新 access token 时使用的请求体。"""

    refresh_token: str


class Token(BaseModel):
    """认证接口返回的令牌对。"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
