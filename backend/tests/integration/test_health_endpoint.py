from collections.abc import Generator

from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_db
from app.main import app


def test_health_returns_ok_when_database_is_available(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "toast_duration_ms": 2400,
        "auth_registration_enabled": True,
    }
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"


def test_health_returns_503_when_database_is_unavailable(client) -> None:
    class BrokenSession:
        def execute(self, *_args, **_kwargs) -> None:
            raise SQLAlchemyError("database unavailable")

        def close(self) -> None:
            return None

    def override_broken_db() -> Generator[BrokenSession, None, None]:
        yield BrokenSession()

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_broken_db

    try:
        response = client.get("/health")
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_override

    assert response.status_code == 503
    assert response.json() == {
        "detail": {
            "status": "degraded",
            "database": "unavailable",
        }
    }
    assert response.headers["x-content-type-options"] == "nosniff"
