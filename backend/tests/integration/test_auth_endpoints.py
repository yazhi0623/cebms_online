from fastapi.testclient import TestClient


def test_register_login_me_and_refresh_flow(client: TestClient) -> None:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"username": "auth_user", "password": "auth_pass_123"},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "auth_user", "password": "auth_pass_123"},
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert tokens["token_type"] == "bearer"

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "auth_user"

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert logout_response.status_code == 200

    revoked_me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert revoked_me_response.status_code == 401

    revoked_refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert revoked_refresh_response.status_code == 401
    assert revoked_refresh_response.json()["detail"] == "Refresh token has been revoked"


def test_register_rejects_duplicate_username(client: TestClient) -> None:
    payload = {"username": "dup_user", "password": "dup_pass_123"}

    first_response = client.post("/api/v1/auth/register", json=payload)
    second_response = client.post("/api/v1/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Username already exists"


def test_login_rejects_invalid_password(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"username": "login_user", "password": "right_pass_123"},
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"username": "login_user", "password": "wrong_pass_123"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_register_can_be_disabled(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "AUTH_REGISTRATION_ENABLED", False)

    response = client.post(
        "/api/v1/auth/register",
        json={"username": "closed_user", "password": "closed_pass_123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Registration is currently disabled"


def test_login_rate_limit_blocks_repeated_failures(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT_ATTEMPTS", 3)
    client.post(
        "/api/v1/auth/register",
        json={"username": "limit_user", "password": "right_pass_123"},
    )

    for _ in range(3):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "limit_user", "password": "wrong_pass_123"},
        )
        assert response.status_code == 401

    blocked_response = client.post(
        "/api/v1/auth/login",
        json={"username": "limit_user", "password": "wrong_pass_123"},
    )

    assert blocked_response.status_code == 429
    assert blocked_response.json()["detail"] == "Too many login attempts, please try again later"


def test_login_rate_limit_uses_forwarded_client_ip(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT_ATTEMPTS", 3)
    client.post(
        "/api/v1/auth/register",
        json={"username": "proxy_user", "password": "right_pass_123"},
    )

    for _ in range(3):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "proxy_user", "password": "wrong_pass_123"},
            headers={"X-Forwarded-For": "198.51.100.10, 10.0.0.2"},
        )
        assert response.status_code == 401

    blocked_response = client.post(
        "/api/v1/auth/login",
        json={"username": "proxy_user", "password": "right_pass_123"},
        headers={"X-Forwarded-For": "198.51.100.10, 10.0.0.2"},
    )
    assert blocked_response.status_code == 429

    allowed_response = client.post(
        "/api/v1/auth/login",
        json={"username": "proxy_user", "password": "right_pass_123"},
        headers={"X-Forwarded-For": "203.0.113.25, 10.0.0.2"},
    )
    assert allowed_response.status_code == 200
