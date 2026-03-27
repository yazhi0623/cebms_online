import json
from datetime import datetime

from app.core.config import settings
from app.models.record import Record
from app.services.llm_analysis_service import LLMAnalysisService


def test_get_ordered_models_starts_from_current_model_index() -> None:
    service = LLMAnalysisService("unused")
    payload = {
        "current_model_index": 1,
        "models": [
            {"name": "qwen-a"},
            {"name": "qwen-b"},
            {"name": "qwen-c"},
        ],
    }

    ordered = service._get_ordered_models(payload)

    assert [item["name"] for item in ordered] == ["qwen-b", "qwen-c"]


def test_get_ordered_models_switches_to_deepseek_when_qwen_exhausted(monkeypatch) -> None:
    service = LLMAnalysisService("unused")
    monkeypatch.setattr(settings, "DEEPSEEK_MODEL", "deepseek-chat")
    payload = {
        "current_model_index": 2,
        "models": [
            {"name": "qwen-a"},
            {"name": "qwen-b"},
            {"name": "qwen-c"},
        ],
    }

    ordered = service._get_ordered_models(payload)

    assert [item["name"] for item in ordered] == ["deepseek-chat"]


def test_switch_model_only_on_4xx(tmp_path) -> None:
    models_path = tmp_path / "models.json"
    models_path.write_text(
        json.dumps(
            {
                "current_model_index": 0,
                "failed_attempts": {},
                "models": [
                    {"name": "qwen-a"},
                    {"name": "qwen-b"},
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    service = LLMAnalysisService(str(models_path))

    payload = service._load_models_payload()
    assert service._should_switch_model(403) is True
    service._switch_model(payload, "qwen-a", 403)

    switched = json.loads(models_path.read_text(encoding="utf-8"))
    assert switched["current_model_index"] == 1
    assert switched["failed_attempts"]["qwen-a"]["status_code"] == 403
    assert service._should_switch_model(500) is False


def test_switch_model_stops_at_last_qwen_index(tmp_path) -> None:
    models_path = tmp_path / "models.json"
    models_path.write_text(
        json.dumps(
            {
                "current_model_index": 1,
                "failed_attempts": {},
                "models": [
                    {"name": "qwen-a"},
                    {"name": "qwen-b"},
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    service = LLMAnalysisService(str(models_path))

    payload = service._load_models_payload()
    service._switch_model(payload, "qwen-b", 403)

    switched = json.loads(models_path.read_text(encoding="utf-8"))
    assert switched["current_model_index"] == 1
    assert switched["failed_attempts"]["qwen-b"]["status_code"] == 403


def test_build_prompt_keeps_full_input_and_mentions_output_limit(monkeypatch) -> None:
    service = LLMAnalysisService("unused")
    monkeypatch.setattr(settings, "ANALYSIS_MAX_LLM_OUTPUT_CHARS", 300)
    long_content = "输入内容" * 200
    record = Record(
        user_id=1,
        title="长记录",
        content=long_content,
        updated_at=datetime(2026, 3, 25, 8, 0, 0),
    )

    prompt = service._build_prompt([record], "全部")

    assert long_content in prompt
    assert "正文总长度控制在300字以内" in prompt
    assert "结合每条记录的时间和内容" in prompt
    assert "状态变化" in prompt


def test_build_prompt_orders_records_from_earliest_to_latest() -> None:
    service = LLMAnalysisService("unused")
    older = Record(
        user_id=1,
        title="较早记录",
        content="先前内容",
        updated_at=datetime(2026, 3, 20, 8, 0, 0),
    )
    newer = Record(
        user_id=1,
        title="较新记录",
        content="后续内容",
        updated_at=datetime(2026, 3, 25, 9, 0, 0),
    )

    prompt = service._build_prompt([newer, older], "全部")

    assert prompt.index("时间：2026-03-20 08:00:00") < prompt.index("时间：2026-03-25 09:00:00")
    assert "内容：先前内容" in prompt
    assert "内容：后续内容" in prompt


def test_limit_output_length_trims_model_response(monkeypatch) -> None:
    service = LLMAnalysisService("unused")
    monkeypatch.setattr(settings, "ANALYSIS_MAX_LLM_OUTPUT_CHARS", 300)

    limited = service._limit_output_length("甲" * 320)

    assert len(limited) == 300
    assert limited == "甲" * 300
