from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.user import RefreshTokenRequest, UserCreate, UserLogin
from app.services.auth_service import AuthService


class StubUserRepository:
    def __init__(self) -> None:
        self.users: dict[str, SimpleNamespace] = {}
        self.created_user: SimpleNamespace | None = None

    def get_by_username(self, username: str):
        return self.users.get(username)

    def create(self, username: str, password_hash: str):
        user = SimpleNamespace(id=len(self.users) + 1, username=username, password_hash=password_hash, token_version=0)
        self.users[username] = user
        self.created_user = user
        return user

    def increment_token_version(self, user):
        user.token_version += 1
        return user


def test_register_creates_user_with_hashed_password(monkeypatch) -> None:
    repository = StubUserRepository()
    service = AuthService(repository)

    monkeypatch.setattr("app.services.auth_service.get_password_hash", lambda password: f"hashed::{password}")

    user = service.register(UserCreate(username="unit_user", password="secret_123"))

    assert user.username == "unit_user"
    assert repository.created_user is not None
    assert repository.created_user.password_hash == "hashed::secret_123"


def test_register_rejects_duplicate_username() -> None:
    repository = StubUserRepository()
    repository.users["exists"] = SimpleNamespace(id=1, username="exists", password_hash="hash", token_version=0)
    service = AuthService(repository)

    with pytest.raises(HTTPException) as exc:
        service.register(UserCreate(username="exists", password="secret_123"))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Username already exists"


def test_login_returns_token_pair(monkeypatch) -> None:
    repository = StubUserRepository()
    repository.users["unit_user"] = SimpleNamespace(id=1, username="unit_user", password_hash="hash", token_version=3)
    service = AuthService(repository)

    monkeypatch.setattr("app.services.auth_service.verify_password", lambda plain, hashed: plain == "secret_123" and hashed == "hash")
    monkeypatch.setattr("app.services.auth_service.create_access_token", lambda subject, token_version: f"access::{subject}::{token_version}")
    monkeypatch.setattr("app.services.auth_service.create_refresh_token", lambda subject, token_version: f"refresh::{subject}::{token_version}")

    token = service.login(UserLogin(username="unit_user", password="secret_123"))

    assert token.access_token == "access::unit_user::3"
    assert token.refresh_token == "refresh::unit_user::3"
    assert token.token_type == "bearer"


def test_refresh_token_rejects_non_refresh_token(monkeypatch) -> None:
    repository = StubUserRepository()
    service = AuthService(repository)

    monkeypatch.setattr("app.services.auth_service.decode_token", lambda token: {"sub": "unit_user", "type": "access"})

    with pytest.raises(HTTPException) as exc:
        service.refresh_token(RefreshTokenRequest(refresh_token="bad-token"))

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid refresh token"


def test_register_rejects_when_registration_disabled(monkeypatch) -> None:
    repository = StubUserRepository()
    service = AuthService(repository)
    monkeypatch.setattr(settings, "AUTH_REGISTRATION_ENABLED", False)

    with pytest.raises(HTTPException) as exc:
        service.register(UserCreate(username="closed_user", password="secret_123"))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Registration is currently disabled"


def test_refresh_token_rejects_revoked_token(monkeypatch) -> None:
    repository = StubUserRepository()
    repository.users["unit_user"] = SimpleNamespace(id=1, username="unit_user", password_hash="hash", token_version=2)
    service = AuthService(repository)

    monkeypatch.setattr("app.services.auth_service.decode_token", lambda token: {"sub": "unit_user", "type": "refresh", "ver": 1})

    with pytest.raises(HTTPException) as exc:
        service.refresh_token(RefreshTokenRequest(refresh_token="stale-token"))

    assert exc.value.status_code == 401
    assert exc.value.detail == "Refresh token has been revoked"


def test_logout_increments_token_version() -> None:
    repository = StubUserRepository()
    user = SimpleNamespace(id=1, username="unit_user", password_hash="hash", token_version=0)
    repository.users["unit_user"] = user
    service = AuthService(repository)

    result = service.logout(user)

    assert result == {"message": "Logged out"}
    assert user.token_version == 1
