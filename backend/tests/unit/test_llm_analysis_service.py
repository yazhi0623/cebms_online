import json
from datetime import UTC, datetime

from app.core.config import settings
from app.models.record import Record
from app.services.llm_analysis_service import LLMAnalysisService
from app.services.weather_service import WeatherSnapshot


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
    record = Record(
        user_id=1,
        title="长记录",
        content="输入内容" * 200,
        created_at=datetime(2026, 3, 25, 8, 0, 0, tzinfo=UTC),
        updated_at=datetime(2026, 3, 25, 8, 0, 0, tzinfo=UTC),
    )

    prompt = service._build_prompt([record], "全部")

    assert "输入内容" * 50 in prompt
    assert "正文总长度控制在400字以内，但不要为了压缩字数省略关键事实、重要问题或必要建议。" in prompt
    assert "结合每条记录的时间和内容" in prompt
    assert "状态变化" in prompt
    assert "记录数会由系统单独展示" in prompt
    assert "不少于三分之一的记录中出现时，才能明确称为高频" in prompt


def test_build_prompt_orders_records_from_earliest_to_latest() -> None:
    service = LLMAnalysisService("unused")
    older = Record(
        user_id=1,
        title="较早记录",
        content="先前内容",
        created_at=datetime(2026, 3, 20, 8, 0, 0, tzinfo=UTC),
        updated_at=datetime(2026, 3, 20, 8, 0, 0, tzinfo=UTC),
    )
    newer = Record(
        user_id=1,
        title="较新记录",
        content="后续内容",
        created_at=datetime(2026, 3, 25, 9, 0, 0, tzinfo=UTC),
        updated_at=datetime(2026, 3, 25, 9, 0, 0, tzinfo=UTC),
    )

    prompt = service._build_prompt([newer, older], "全部")

    assert prompt.index("时间：2026-03-20 08:00:00") < prompt.index("时间：2026-03-25 09:00:00")
    assert "内容：先前内容" in prompt
    assert "内容：后续内容" in prompt


def test_build_prompt_includes_crisis_and_sunlight_guidance() -> None:
    service = LLMAnalysisService("unused")
    today = datetime.now(UTC)
    record = Record(
        user_id=1,
        title="今天",
        content="情绪分值(1~10)：2\n其他：好烦",
        created_at=today,
        updated_at=today,
    )
    weather_snapshot = WeatherSnapshot(location_label="上海", is_sunny=True, is_daylight=True, weather_code=0)

    prompt = service._build_prompt([record], "全部", weather_snapshot)

    assert "情绪崩溃状态" in prompt
    assert "休息建议" in prompt
    assert "晒太阳建议" in prompt


def test_build_summary_prompt_mentions_frequency_threshold_and_system_count_display() -> None:
    service = LLMAnalysisService("unused")

    prompt = service._build_summary_prompt(["第一组分析", "第二组分析", "第三组分析"], "全部（汇总）")

    assert "正文总长度控制在300字以内，但不要为了压缩字数省略关键事实、重要问题或必要建议。" in prompt
    assert "记录数会由系统单独展示" in prompt
    assert "不少于三分之一的分析样本中出现时，才能明确称为高频" in prompt
    assert "比较严重的问题或高频问题" in prompt


def test_call_model_does_not_trim_response(monkeypatch) -> None:
    service = LLMAnalysisService("unused")

    class StubCompletions:
        @staticmethod
        def create(**kwargs):
            del kwargs
            return type(
                "Response",
                (),
                {"choices": [type("Choice", (), {"message": type("Message", (), {"content": "字" * 420})()})()]},
            )()

    class StubClient:
        chat = type("Chat", (), {"completions": StubCompletions()})()

    monkeypatch.setattr(service, "_build_client", lambda model_name: StubClient())

    response = service._call_model("deepseek-chat", "prompt")

    assert response["ok"] is True
    assert response["status_code"] == 200
    assert response["content"] == "字" * 420
