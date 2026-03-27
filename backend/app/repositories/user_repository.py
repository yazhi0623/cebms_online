from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    """封装用户相关的数据库读写。"""
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_username(self, username: str) -> User | None:
        """按用户名查询用户，不存在则返回空。"""
        return self.db.scalar(select(User).where(User.username == username))

    def create(self, username: str, password_hash: str) -> User:
        """插入新用户，并刷新数据库生成的字段。"""
        user = User(username=username, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def increment_token_version(self, user: User) -> User:
        """增加令牌版本，让旧令牌失效。"""
        user.token_version += 1
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
