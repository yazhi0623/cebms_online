from datetime import date

from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.llm_analysis_service import LLMAnalysisError, LLMAnalysisService


EMOTION_LABEL = "情绪分值(1~10)"
WEATHER_LABEL = "天气"
SLEEP_LABEL = "睡眠"
EXERCISE_LABEL = "运动"
MEALS_LABEL = "三餐"
DID_WHAT_LABEL = "做了什么"
PROBLEM_LABEL = "遇到了什么问题"
SOLUTION_LABEL = "解决方法"
GRATITUDE_LABEL = "感恩"
IMPROVEMENT_LABEL = "需要改进"
OTHER_LABEL = "其他"
RECORD_COUNT_TEXT = "本次纳入分析的记录数"


def stub_analysis_result(range_label: str) -> str:
    return f"【分析范围】{range_label}\n总体趋势：稳定。\n下一步建议：先完成一件小事。"


def stub_summary_result(range_label: str) -> str:
    return f"【分析范围】{range_label}\n总体趋势：整体稳定。\n下一步建议：延续当前节奏。"


def build_record_content(index: int) -> str:
    return "\n".join(
        [
            f"{EMOTION_LABEL}：{index % 10 + 1}",
            f"{WEATHER_LABEL}：晴",
            f"{SLEEP_LABEL}：7小时",
            f"{EXERCISE_LABEL}：散步",
            f"{MEALS_LABEL}：正常",
            f"{DID_WHAT_LABEL}：事项{index}",
            f"{PROBLEM_LABEL}：拖延",
            f"{SOLUTION_LABEL}：拆分任务",
            f"{GRATITUDE_LABEL}：家人",
            f"{IMPROVEMENT_LABEL}：早睡",
            f"{OTHER_LABEL}：无",
        ]
    )


def test_generate_analysis_requires_threshold(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    client.post("/api/v1/records", json={"title": "Only One", "content": build_record_content(1)}, headers=auth_headers)

    response = client.post("/api/v1/analyses/generate", json={"record_id": None, "range_months": 0}, headers=auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "At least 2 records are required for analysis"


def test_generate_analysis_does_not_append_to_record_and_updates_count(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", True)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: stub_analysis_result(range_label),
    )

    latest_record_id = None
    for index in range(2):
        response = client.post("/api/v1/records", json={"title": f"Record {index}", "content": build_record_content(index)}, headers=auth_headers)
        assert response.status_code == 201
        latest_record_id = response.json()["id"]

    generate_response = client.post("/api/v1/analyses/generate", json={"record_id": latest_record_id, "range_months": 3}, headers=auth_headers)
    assert generate_response.status_code == 201
    analysis = generate_response.json()
    assert analysis["record_id"] == latest_record_id
    assert "【分析范围】近三个月" in analysis["content"]
    assert f"{RECORD_COUNT_TEXT}：2 条" in analysis["content"]
    assert "平均情绪分值" not in analysis["content"]

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    count_payload = count_response.json()
    assert count_payload["count"] == 1
    assert count_payload["limit"] == 3
    assert count_payload["threshold"] == 2
    assert count_payload["llm_enabled"] is True
    assert count_payload["day_key"] == date.today().isoformat()


def test_batched_generate_analysis_counts_as_one_today_usage(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 1)
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", True)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: stub_analysis_result(range_label),
    )
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_summary_text",
        lambda self, analysis_texts, range_label, user_profile_text=None: stub_summary_result(range_label),
    )

    for index in range(31):
        response = client.post(
            "/api/v1/records",
            json={"title": f"Record {index}", "content": build_record_content(index)},
            headers=auth_headers,
        )
        assert response.status_code == 201

    generate_response = client.post("/api/v1/analyses/generate", json={"record_id": None, "range_months": 0}, headers=auth_headers)
    assert generate_response.status_code == 201
    assert generate_response.json()["analysis_type"] == "batch_summary"

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    assert count_response.json()["count"] == 1

    create_response = client.post(
        "/api/v1/analyses",
        json={"record_id": None, "content": "manual analysis", "day_key": date.today().isoformat()},
        headers=auth_headers,
    )
    assert create_response.status_code == 400
    assert create_response.json()["detail"] == "Daily analysis limit reached (1)"


def test_analysis_task_generates_result_in_background(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", True)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: stub_analysis_result(range_label),
    )

    for index in range(2):
        response = client.post(
            "/api/v1/records",
            json={"title": f"Task Record {index}", "content": build_record_content(index)},
            headers=auth_headers,
        )
        assert response.status_code == 201

    create_task_response = client.post(
        "/api/v1/analyses/tasks",
        json={"range_months": 12},
        headers=auth_headers,
    )

    assert create_task_response.status_code == 201
    task_payload = create_task_response.json()
    assert task_payload["status"] in {"pending", "running", "success"}

    task_response = client.get(f"/api/v1/analyses/tasks/{task_payload['id']}", headers=auth_headers)
    assert task_response.status_code == 200
    task = task_response.json()
    assert task["status"] == "success"
    assert isinstance(task["result_analysis_id"], int)
    assert task["error_message"] is None

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    assert count_response.json()["count"] == 1


def test_analysis_task_marks_failure_without_breaking_creation_response(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    response = client.post(
        "/api/v1/analyses/tasks",
        json={"range_months": 0},
        headers=auth_headers,
    )

    assert response.status_code == 201
    task_id = response.json()["id"]

    task_response = client.get(f"/api/v1/analyses/tasks/{task_id}", headers=auth_headers)
    assert task_response.status_code == 200
    task = task_response.json()
    assert task["status"] == "failed"
    assert task["error_message"] == "At least 2 records are required for analysis"
    assert task["result_analysis_id"] is None


def test_generate_analysis_rejects_when_llm_is_disabled(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", False)

    response = client.post(
        "/api/v1/analyses/generate",
        json={"range_months": 0},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "AI analysis is currently disabled"


def test_analysis_task_fails_when_llm_is_disabled(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", False)

    response = client.post(
        "/api/v1/analyses/tasks",
        json={"range_months": 0},
        headers=auth_headers,
    )

    assert response.status_code == 201
    task_id = response.json()["id"]

    task_response = client.get(f"/api/v1/analyses/tasks/{task_id}", headers=auth_headers)
    assert task_response.status_code == 200
    assert task_response.json()["status"] == "failed"
    assert task_response.json()["error_message"] == "AI analysis is currently disabled"


def test_generate_analysis_does_not_create_record_or_count_when_llm_call_fails(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", True)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: (_ for _ in ()).throw(LLMAnalysisError(503)),
    )

    for index in range(2):
        response = client.post(
            "/api/v1/records",
            json={"title": f"Fail Record {index}", "content": build_record_content(index)},
            headers=auth_headers,
        )
        assert response.status_code == 201

    generate_response = client.post("/api/v1/analyses/generate", json={"range_months": 0}, headers=auth_headers)

    assert generate_response.status_code == 502
    assert generate_response.json()["detail"] == "无法调用大模型，状态码：503"

    list_response = client.get("/api/v1/analyses", headers=auth_headers)
    assert list_response.status_code == 200
    assert list_response.json() == []

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    assert count_response.json()["count"] == 0


def test_analysis_task_does_not_create_record_or_count_when_llm_call_fails(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", True)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: (_ for _ in ()).throw(LLMAnalysisError(429)),
    )

    for index in range(2):
        response = client.post(
            "/api/v1/records",
            json={"title": f"Task Fail Record {index}", "content": build_record_content(index)},
            headers=auth_headers,
        )
        assert response.status_code == 201

    create_task_response = client.post(
        "/api/v1/analyses/tasks",
        json={"range_months": 0},
        headers=auth_headers,
    )

    assert create_task_response.status_code == 201
    task_id = create_task_response.json()["id"]

    task_response = client.get(f"/api/v1/analyses/tasks/{task_id}", headers=auth_headers)
    assert task_response.status_code == 200
    task_payload = task_response.json()
    assert task_payload["status"] == "failed"
    assert task_payload["error_message"] == "无法调用大模型，状态码：429"
    assert task_payload["result_analysis_id"] is None

    list_response = client.get("/api/v1/analyses", headers=auth_headers)
    assert list_response.status_code == 200
    assert list_response.json() == []

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    assert count_response.json()["count"] == 0


def test_generate_analysis_by_template_only_uses_records_with_same_template(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)
    monkeypatch.setattr(
        LLMAnalysisService,
        "generate_analysis_text",
        lambda self, records, range_label, user_profile_text=None: stub_analysis_result(range_label),
    )

    template_response = client.post(
        "/api/v1/templates",
        json={"title": "晨间复盘", "content": "模板内容", "is_default": False},
        headers=auth_headers,
    )
    assert template_response.status_code == 201
    template_id = template_response.json()["id"]

    for index in range(2):
        response = client.post(
            "/api/v1/records",
            json={"title": f"Template Record {index}", "content": build_record_content(index), "template_id": template_id},
            headers=auth_headers,
        )
        assert response.status_code == 201

    other_response = client.post(
        "/api/v1/records",
        json={"title": "Other Record", "content": build_record_content(9), "template_id": None},
        headers=auth_headers,
    )
    assert other_response.status_code == 201

    generate_response = client.post("/api/v1/analyses/generate", json={"template_id": template_id, "range_months": 0}, headers=auth_headers)

    assert generate_response.status_code == 201
    analysis = generate_response.json()
    assert analysis["template_id"] == template_id
    assert "【分析范围】模板：晨间复盘" in analysis["content"]


def test_create_analysis_respects_daily_limit(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 1)

    first_response = client.post("/api/v1/analyses", json={"record_id": None, "content": "manual analysis", "day_key": date.today().isoformat()}, headers=auth_headers)
    second_response = client.post("/api/v1/analyses", json={"record_id": None, "content": "manual analysis 2", "day_key": date.today().isoformat()}, headers=auth_headers)

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Daily analysis limit reached (1)"


def test_aggregate_analyses_returns_saved_content(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)

    create_response = client.post("/api/v1/analyses", json={"record_id": None, "content": "saved analysis", "day_key": date.today().isoformat()}, headers=auth_headers)
    assert create_response.status_code == 201

    aggregate_response = client.get("/api/v1/analyses/aggregate", headers=auth_headers)

    assert aggregate_response.status_code == 200
    payload = aggregate_response.json()
    assert payload["count"] == 1
    assert payload["total_count"] == 1
    assert "saved analysis" in payload["content"]


def test_delete_analysis_keeps_today_count_but_clears_history(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)

    create_response = client.post("/api/v1/analyses", json={"record_id": None, "content": "saved analysis", "day_key": date.today().isoformat()}, headers=auth_headers)
    assert create_response.status_code == 201
    analysis_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/analyses/{analysis_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    list_response = client.get("/api/v1/analyses", headers=auth_headers)
    assert list_response.status_code == 200
    assert list_response.json() == []

    aggregate_response = client.get("/api/v1/analyses/aggregate", headers=auth_headers)
    assert aggregate_response.status_code == 200
    aggregate_payload = aggregate_response.json()
    assert aggregate_payload["count"] == 0
    assert aggregate_payload["total_count"] == 1
    assert aggregate_payload["latest_day"] is None

    count_response = client.get("/api/v1/analyses/count/today", headers=auth_headers)
    assert count_response.status_code == 200
    assert count_response.json()["count"] == 1
