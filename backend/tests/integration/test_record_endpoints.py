from fastapi.testclient import TestClient


def test_record_crud_flow(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_response = client.post(
        "/api/v1/records",
        json={"title": "Day 1", "content": "content 1"},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    record = create_response.json()

    get_response = client.get(f"/api/v1/records/{record['id']}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Day 1"

    update_response = client.put(
        f"/api/v1/records/{record['id']}",
        json={"title": "Day 1 Updated", "content": "content 2"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Day 1 Updated"

    delete_response = client.delete(f"/api/v1/records/{record['id']}", headers=auth_headers)
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/v1/records/{record['id']}", headers=auth_headers)
    assert missing_response.status_code == 404
    assert missing_response.json()["detail"] == "Record not found"


def test_record_access_is_user_scoped(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_response = client.post(
        "/api/v1/records",
        json={"title": "Private", "content": "secret"},
        headers=auth_headers,
    )
    record_id = create_response.json()["id"]

    client.post("/api/v1/auth/register", json={"username": "record_other", "password": "other_pass_123"})
    other_login = client.post(
        "/api/v1/auth/login",
        json={"username": "record_other", "password": "other_pass_123"},
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

    other_get = client.get(f"/api/v1/records/{record_id}", headers=other_headers)
    other_list = client.get("/api/v1/records", headers=other_headers)

    assert other_get.status_code == 404
    assert other_list.status_code == 200
    assert other_list.json() == []
