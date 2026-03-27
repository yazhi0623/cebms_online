import json

from fastapi.testclient import TestClient


def test_txt_import_supports_records_export_txt_format(client: TestClient, auth_headers: dict[str, str]) -> None:
    txt_payload = "\n".join(
        [
            json.dumps({"title": "Exported A", "content": "Alpha"}, ensure_ascii=False),
            json.dumps({"title": "Exported B", "content": "Beta"}, ensure_ascii=False),
        ]
    ).encode("utf-8")

    response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "txt"},
        files={"file": ("records-export.txt", txt_payload, "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 201

    imports_response = client.get("/api/v1/imports/records", headers=auth_headers)
    task = imports_response.json()[0]
    assert task["status"] == "success"
    assert task["success_count"] == 2

    records_response = client.get("/api/v1/records", headers=auth_headers)
    titles = {item["title"] for item in records_response.json()}
    assert titles == {"Exported A", "Exported B"}


def test_txt_import_keeps_date_prefixed_plain_text_mode(client: TestClient, auth_headers: dict[str, str]) -> None:
    txt_payload = "\n".join(
        [
            "20250322",
            "Plain text record one",
            "",
            "250305",
            "Plain text record two",
        ]
    ).encode("utf-8")

    response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "txt"},
        files={"file": ("journal.txt", txt_payload, "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 201

    records_response = client.get("/api/v1/records", headers=auth_headers)
    titles = {item["title"] for item in records_response.json()}
    assert "20250322导入记录" in titles
    assert "250305导入记录" in titles
