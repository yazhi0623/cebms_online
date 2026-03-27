import json
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook


def test_record_import_supports_json_xlsx_txt_and_markdown(client: TestClient, auth_headers: dict[str, str]) -> None:
    json_payload = json.dumps([{"title": "JSON Record", "content": "From JSON"}]).encode("utf-8")
    xlsx_buffer = BytesIO()
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["title", "content"])
    sheet.append(["XLSX Record", "From XLSX"])
    workbook.save(xlsx_buffer)
    xlsx_payload = xlsx_buffer.getvalue()
    txt_payload = "\n".join(["20250322", "TXT line 1", "TXT line 2"]).encode("utf-8")
    markdown_payload = "\n".join(["# Markdown Record", "", "From markdown"]).encode("utf-8")

    json_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "json"},
        files={"file": ("records.json", json_payload, "application/json")},
        headers=auth_headers,
    )
    xlsx_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "xlsx"},
        files={"file": ("records.xlsx", xlsx_payload, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=auth_headers,
    )
    txt_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "txt"},
        files={"file": ("records.txt", txt_payload, "text/plain")},
        headers=auth_headers,
    )
    markdown_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "markdown"},
        files={"file": ("records.md", markdown_payload, "text/markdown")},
        headers=auth_headers,
    )

    assert json_response.status_code == 201
    assert xlsx_response.status_code == 201
    assert txt_response.status_code == 201
    assert markdown_response.status_code == 201

    imports_response = client.get("/api/v1/imports/records", headers=auth_headers)
    assert imports_response.status_code == 200
    tasks = imports_response.json()
    assert [task["source_type"] for task in tasks[:4]] == ["markdown", "txt", "xlsx", "json"]
    assert all(task["status"] == "success" for task in tasks[:4])

    records_response = client.get("/api/v1/records", headers=auth_headers)
    records = records_response.json()
    titles = {item["title"] for item in records}
    assert "JSON Record" in titles
    assert "XLSX Record" in titles
    assert "20250322导入记录" in titles
    assert "Markdown Record" in titles


def test_markdown_import_supports_exported_markdown_sections(client: TestClient, auth_headers: dict[str, str]) -> None:
    markdown_payload = "\n".join(
        [
            "## Item 1",
            "",
            "- **title**: Record A",
            "- **content**: Alpha body",
            "",
            "## Item 2",
            "",
            "- **title**: Record B",
            "- **content**: Beta body",
        ]
    ).encode("utf-8")

    response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "markdown"},
        files={"file": ("records-export.md", markdown_payload, "text/markdown")},
        headers=auth_headers,
    )

    assert response.status_code == 201

    records_response = client.get("/api/v1/records", headers=auth_headers)
    records = records_response.json()
    assert {item["title"] for item in records} == {"Record A", "Record B"}


def test_markdown_import_keeps_exported_created_and_updated_time(client: TestClient, auth_headers: dict[str, str]) -> None:
    markdown_payload = "\n".join(
        [
            "## 记录1",
            "",
            "- **标题**：Markdown Exported",
            "### 内容",
            "",
            "第一行",
            "第二行",
            "",
            "- **创建时间**：2026/03/18 12:13:14",
            "- **更新时间**：2026/03/19 15:16:17",
        ]
    ).encode("utf-8")

    response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "markdown"},
        files={"file": ("records-export.md", markdown_payload, "text/markdown")},
        headers=auth_headers,
    )

    assert response.status_code == 201

    records_response = client.get("/api/v1/records", headers=auth_headers)
    record = records_response.json()[0]
    assert record["title"] == "Markdown Exported"
    assert record["content"] == "第一行\n第二行"
    assert record["created_at"].startswith("2026-03-18T12:13:14")
    assert record["updated_at"].startswith("2026-03-19T15:16:17")


def test_record_import_keeps_created_and_updated_time_from_file(client: TestClient, auth_headers: dict[str, str]) -> None:
    json_payload = json.dumps(
        [
            {
                "标题": "JSON With Time",
                "内容": "Json body",
                "创建时间": "2026/03/22 22:22:34",
                "更新时间": "2026/03/23 08:09:10",
            }
        ],
        ensure_ascii=False,
    ).encode("utf-8")

    xlsx_buffer = BytesIO()
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["标题", "内容", "创建时间", "更新时间"])
    sheet.append(["XLSX With Time", "Xlsx body", "2026/03/20 10:11:12", "2026/03/21 09:08:07"])
    workbook.save(xlsx_buffer)

    markdown_payload = "\n".join(
        [
            "## 记录1",
            "",
            "- **标题**：Markdown With Time",
            "- **创建时间**：2026/03/18 12:13:14",
            "- **更新时间**：2026/03/19 15:16:17",
            "### 内容",
            "",
            "Markdown body",
        ]
    ).encode("utf-8")

    txt_payload = "\n".join(
        [
            "【记录1】",
            "标题：TXT With Time",
            "内容：",
            "Txt body",
            "创建时间：2026/03/16 01:02:03",
            "更新时间：2026/03/17 04:05:06",
        ]
    ).encode("utf-8")

    client.post(
        "/api/v1/imports/records",
        data={"source_type": "json"},
        files={"file": ("records.json", json_payload, "application/json")},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/imports/records",
        data={"source_type": "xlsx"},
        files={"file": ("records.xlsx", xlsx_buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/imports/records",
        data={"source_type": "markdown"},
        files={"file": ("records.md", markdown_payload, "text/markdown")},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/imports/records",
        data={"source_type": "txt"},
        files={"file": ("records.txt", txt_payload, "text/plain")},
        headers=auth_headers,
    )

    records_response = client.get("/api/v1/records", headers=auth_headers)
    records = {item["title"]: item for item in records_response.json()}

    assert records["JSON With Time"]["created_at"].startswith("2026-03-22T22:22:34")
    assert records["JSON With Time"]["updated_at"].startswith("2026-03-23T08:09:10")
    assert records["XLSX With Time"]["created_at"].startswith("2026-03-20T10:11:12")
    assert records["XLSX With Time"]["updated_at"].startswith("2026-03-21T09:08:07")
    assert records["Markdown With Time"]["created_at"].startswith("2026-03-18T12:13:14")
    assert records["Markdown With Time"]["updated_at"].startswith("2026-03-19T15:16:17")
    assert records["TXT With Time"]["created_at"].startswith("2026-03-16T01:02:03")
    assert records["TXT With Time"]["updated_at"].startswith("2026-03-17T04:05:06")


def test_record_import_skips_existing_data_by_id(client: TestClient, auth_headers: dict[str, str]) -> None:
    json_payload = json.dumps(
        [{"id": 501, "title": "Same ID Record", "content": "Body"}],
        ensure_ascii=False,
    ).encode("utf-8")

    first_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "json"},
        files={"file": ("records.json", json_payload, "application/json")},
        headers=auth_headers,
    )
    second_response = client.post(
        "/api/v1/imports/records",
        data={"source_type": "json"},
        files={"file": ("records.json", json_payload, "application/json")},
        headers=auth_headers,
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201

    imports_response = client.get("/api/v1/imports/records", headers=auth_headers)
    tasks = imports_response.json()
    assert tasks[0]["failed_count"] == 1
    assert tasks[1]["success_count"] == 1

    records_response = client.get("/api/v1/records", headers=auth_headers)
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["title"] == "Same ID Record"
