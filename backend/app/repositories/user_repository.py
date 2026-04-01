from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_username(self, username: str) -> User | None:
        return self.db.scalar(select(User).where(User.username == username))

    def create(self, username: str, password_hash: str) -> User:
        user = User(username=username, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def increment_token_version(self, user: User) -> User:
        user.token_version += 1
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_profile(
        self,
        user: User,
        *,
        username: str,
        gender: str | None,
        age: int | None,
        city: str | None,
        phone: str | None,
        email: str | None,
    ) -> User:
        user.username = username
        user.gender = gender
        user.age = age
        user.city = city
        user.phone = phone
        user.email = email
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
