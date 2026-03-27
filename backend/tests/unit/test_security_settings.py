import pytest

from app.core.config import Settings


def test_validate_runtime_security_allows_safe_production_settings() -> None:
    settings = Settings(APP_ENV="production", APP_DEBUG=False, JWT_SECRET_KEY="strong-secret-key")

    settings.validate_runtime_security()


def test_validate_runtime_security_rejects_debug_in_production() -> None:
    settings = Settings(APP_ENV="production", APP_DEBUG=True, JWT_SECRET_KEY="strong-secret-key")

    with pytest.raises(RuntimeError, match="APP_DEBUG must be disabled"):
        settings.validate_runtime_security()


def test_validate_runtime_security_rejects_default_jwt_secret_in_production() -> None:
    settings = Settings(APP_ENV="production", APP_DEBUG=False, JWT_SECRET_KEY="change-me")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set"):
        settings.validate_runtime_security()
