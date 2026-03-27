from fastapi import HTTPException, status

from app.core.auth_rate_limit import auth_rate_limiter
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import RefreshTokenRequest, Token, UserCreate, UserLogin


class AuthService:
    """处理账号创建、登录和令牌生命周期。"""
    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    def register(self, user_in: UserCreate) -> User:
        """在校验用户名唯一后创建新用户。"""
        if not settings.AUTH_REGISTRATION_ENABLED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Registration is currently disabled",
            )

        existing_user = self.user_repository.get_by_username(user_in.username)
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )

        return self.user_repository.create(
            username=user_in.username,
            password_hash=get_password_hash(user_in.password),
        )

    def login(self, user_in: UserLogin, client_key: str | None = None) -> Token:
        """校验账号密码并返回一组新令牌。"""
        if client_key:
            auth_rate_limiter.ensure_login_allowed(client_key)

        user = self.user_repository.get_by_username(user_in.username)
        if user is None or not verify_password(user_in.password, user.password_hash):
            if client_key:
                auth_rate_limiter.record_login_failure(client_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        if client_key:
            auth_rate_limiter.clear_login_failures(client_key)

        return Token(
            access_token=create_access_token(subject=user.username, token_version=user.token_version),
            refresh_token=create_refresh_token(subject=user.username, token_version=user.token_version),
        )

    def refresh_token(self, token_in: RefreshTokenRequest) -> Token:
        """用有效刷新令牌重新签发一组新令牌。"""
        payload = decode_token(token_in.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        username = payload.get("sub")
        user = self.user_repository.get_by_username(username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        if payload.get("ver", 0) != user.token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked",
            )

        return Token(
            access_token=create_access_token(subject=user.username, token_version=user.token_version),
            refresh_token=create_refresh_token(subject=user.username, token_version=user.token_version),
        )

    def logout(self, current_user: User) -> dict[str, str]:
        """撤销当前用户既有令牌。"""
        self.user_repository.increment_token_version(current_user)
        return {"message": "Logged out"}
