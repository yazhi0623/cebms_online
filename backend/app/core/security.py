from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """校验明文密码和数据库中的 bcrypt 哈希是否匹配。"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """在持久化前先把密码做哈希。"""
    return pwd_context.hash(password)


def create_access_token(subject: str, token_version: int) -> str:
    """创建短时有效的访问令牌。"""
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "type": "access", "ver": token_version}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str, token_version: int) -> str:
    """创建长时有效的刷新令牌。"""
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {"sub": subject, "exp": expire, "type": "refresh", "ver": token_version}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """使用配置中的密钥和算法解码并校验 JWT。"""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
