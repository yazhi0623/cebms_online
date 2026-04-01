from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.analysis import AnalysisCreate, AnalysisGenerateRequest
from app.services.analysis_service import AnalysisService
from app.services.analysis_summary_service import AnalysisSummaryService
from app.services.weather_service import WeatherSnapshot


class StubLLMAnalysisService:
    def __init__(self, result: str | None = None) -> None:
        self.result = result
        self.calls = []
        self.summary_calls = []

    def generate_analysis_text(self, records, range_label: str, user_profile_text: str | None = None) -> str | None:
        self.calls.append({"records": records, "range_label": range_label, "user_profile_text": user_profile_text})
        return self.result

    def generate_summary_text(
        self,
        analysis_texts,
        range_label: str,
        user_profile_text: str | None = None,
    ) -> str | None:
        self.summary_calls.append(
            {"analysis_texts": analysis_texts, "range_label": range_label, "user_profile_text": user_profile_text}
        )
        return self.result


class StubAnalysisRepository:
    DELETED_ANALYSIS_CONTENT = "__DELETED_ANALYSIS__"

    def __init__(self) -> None:
        self.analyses = []
        self.records = []
        self.deleted_analysis = None
        self.created_analysis = None
        self.record_by_id = {}

    def list_by_user(self, user_id: int):
        return [item for item in self.analyses if item.user_id == user_id and item.content != self.DELETED_ANALYSIS_CONTENT]

    def count_all_by_user(self, user_id: int):
        return len([item for item in self.analyses if item.user_id == user_id])

    def list_by_user_and_day(self, user_id: int, day_key: date):
        return [item for item in self.analyses if item.user_id == user_id and item.day_key == day_key]

    def get_by_id_for_user(self, analysis_id: int, user_id: int):
        for item in self.analyses:
            if item.id == analysis_id and item.user_id == user_id:
                return item
        return None

    def create(self, user_id, record_id, template_id, analysis_type, content, day_key, created_at=None, source_analysis_id=None):
        analysis = SimpleNamespace(
            id=len(self.analyses) + 1,
            user_id=user_id,
            record_id=record_id,
            template_id=template_id,
            analysis_type=analysis_type,
            content=content,
            day_key=day_key,
            created_at=datetime.now(UTC),
        )
        self.analyses.append(analysis)
        self.created_analysis = analysis
        return analysis

    def commit_refresh(self, analysis):
        return analysis

    def delete(self, analysis):
        self.deleted_analysis = analysis
        analysis.content = self.DELETED_ANALYSIS_CONTENT

    def list_records_for_user(self, user_id: int):
        return [item for item in self.records if item.user_id == user_id]

    def get_record_for_user(self, record_id: int, user_id: int):
        record = self.record_by_id.get(record_id)
        if record and record.user_id == user_id:
            return record
        return None


class StubTemplateRepository:
    def __init__(self) -> None:
        self.templates = {}

    def get_by_id_for_user(self, template_id: int, user_id: int):
        template = self.templates.get(template_id)
        if template and template.user_id == user_id:
            return template
        return None


def make_record(record_id: int, user_id: int, content: str, current_time: datetime | None = None, template_id: int | None = None):
    current_time = current_time or datetime.now(UTC)
    return SimpleNamespace(
        id=record_id,
        user_id=user_id,
        template_id=template_id,
        title=f"Record {record_id}",
        content=content,
        created_at=current_time,
        updated_at=current_time,
    )


def make_template(template_id: int, user_id: int, title: str = "模板 A"):
    return SimpleNamespace(id=template_id, user_id=user_id, title=title)


def test_aggregate_analyses_returns_empty_state() -> None:
    service = AnalysisService(StubAnalysisRepository(), StubTemplateRepository())

    result = service.aggregate_analyses(1)

    assert result == {
        "count": 0,
        "content": "暂无已保存的AI分析结果",
        "total_count": 0,
        "latest_day": None,
        "combined_content": "暂无已保存的AI分析结果",
    }


def test_generate_analysis_rejects_when_threshold_not_met(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.records = [make_record(1, 1, "x")]
    service = AnalysisService(repository, StubTemplateRepository())
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    with pytest.raises(HTTPException) as exc:
        service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert exc.value.status_code == 400
    assert exc.value.detail == "At least 2 records are required for analysis"


def test_generate_analysis_uses_llm_result_when_available(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.records = [make_record(1, 1, "x"), make_record(2, 1, "y")]
    llm_service = StubLLMAnalysisService("【分析范围】全部\n总体趋势：稳定")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert "【分析范围】全部" in result.content
    assert "AI分析：" in result.content
    assert "总体趋势：稳定" in result.content
    assert result.analysis_type == "single"
    assert llm_service.calls[0]["range_label"] == "全部"


def test_generate_analysis_batches_large_datasets_and_returns_final_summary(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.records = [make_record(index, 1, f"content {index}") for index in range(1, 62)]
    llm_service = StubLLMAnalysisService("【分析范围】全部\n总体趋势：稳定")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 20)

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert len(repository.analyses) == 4
    assert [analysis.analysis_type for analysis in repository.analyses[:-1]] == ["batch_chunk", "batch_chunk", "batch_chunk"]
    assert repository.analyses[-1].analysis_type == "batch_summary"
    assert "【分析范围】全部（汇总）" in result.content
    assert len(llm_service.calls) == 3
    assert llm_service.summary_calls[0]["range_label"] == "全部（汇总）"


def test_create_analysis_rejects_when_daily_limit_reached(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.analyses = [
        SimpleNamespace(id=1, user_id=1, record_id=None, analysis_type="single", day_key=date.today(), created_at=datetime.now(UTC), content="a")
    ]
    service = AnalysisService(repository, StubTemplateRepository())
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 1)

    with pytest.raises(HTTPException) as exc:
        service.create_analysis(1, AnalysisCreate(record_id=None, content="new", day_key=date.today()))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Daily analysis limit reached (1)"


def test_create_analysis_does_not_write_back_to_record(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    same_day = datetime.now(UTC)
    latest_record = make_record(5, 1, "original", same_day)
    repository.record_by_id[5] = latest_record
    service = AnalysisService(repository, StubTemplateRepository())
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT", 3)

    result = service.create_analysis(1, AnalysisCreate(record_id=5, content="analysis body", day_key=same_day.date()))

    assert result.record_id == 5
    assert latest_record.content == "original"


def test_build_analysis_text_extracts_summary() -> None:
    service = AnalysisService(StubAnalysisRepository(), StubTemplateRepository())
    records = [
        make_record(
            1,
            1,
            "\n".join(
                [
                    "情绪分值(1~10)：8",
                    "天气：晴",
                    "睡眠：7小时",
                    "运动：散步",
                    "三餐：正常",
                    "做了什么：复盘",
                    "遇到了什么问题：拖延",
                    "解决方法：拆分任务",
                    "感恩：家人",
                    "需要改进：早睡",
                    "其他：无",
                ]
            ),
        ),
        make_record(
            2,
            1,
            "\n".join(
                [
                    "情绪分值(1~10)：6",
                    "天气：晴",
                    "睡眠：6小时",
                    "运动：散步",
                    "三餐：正常",
                    "做了什么：运动",
                    "遇到了什么问题：拖延",
                    "解决方法：先做五分钟",
                    "感恩：家人",
                    "需要改进：早睡",
                    "其他：无",
                ]
            ),
        ),
    ]

    result = service._build_analysis_text(records, 3)

    assert "【分析范围】前三个月" in result
    assert "本次纳入分析的记录数：2 条" in result
    assert "平均情绪分值" not in result
    assert "高频问题" not in result
    assert "高频感恩内容" not in result


def test_generate_analysis_keeps_backend_record_count_and_ai_body_separate(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.records = [make_record(1, 1, "x"), make_record(2, 1, "y"), make_record(3, 1, "z")]
    llm_service = StubLLMAnalysisService("【分析范围】全部\n比较严重的问题或高频问题：拖延已经反复出现。\n下一步建议：先做五分钟。")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert "本次纳入分析的记录数：3 条" in result.content
    assert "AI分析：" in result.content
    assert "比较严重的问题或高频问题：拖延已经反复出现。" in result.content


def test_emotional_context_detects_low_energy_and_two_week_streak() -> None:
    today = date(2026, 3, 30)
    records = []
    for offset in range(1, 15):
        current_day = datetime(2026, 3, 30, 8, 0, tzinfo=UTC) - timedelta(days=offset)
        records.append(make_record(offset, 1, "情绪分值(1~10)：2", current_day))
    records.append(make_record(99, 1, "情绪分值(1~10)：4\n其他：有点累", datetime(2026, 3, 30, 9, 0, tzinfo=UTC)))

    context = AnalysisSummaryService.build_emotional_context_text(records, analysis_day=today)

    assert "低能量状态" in context
    assert "最小一步" in context
    assert "连续14个自然日情绪分值都低于3" in context


def test_filter_records_by_range_keeps_recent_records_only(monkeypatch) -> None:
    service = AnalysisService(StubAnalysisRepository(), StubTemplateRepository())
    records = [
        make_record(1, 1, "recent", datetime(2026, 3, 1, tzinfo=UTC)),
        make_record(2, 1, "old", datetime(2025, 11, 30, tzinfo=UTC)),
    ]

    class FakeDate(date):
        @classmethod
        def today(cls) -> date:
            return cls(2026, 3, 17)

    monkeypatch.setattr("app.services.analysis_service.date", FakeDate)

    filtered = service._filter_records_by_range(records, 3)

    assert [record.id for record in filtered] == [1]


def test_delete_analysis_keeps_today_usage_count() -> None:
    repository = StubAnalysisRepository()
    today = date.today()
    repository.analyses = [
        SimpleNamespace(id=1, user_id=1, record_id=None, analysis_type="single", content="analysis content", day_key=today, created_at=datetime.now(UTC))
    ]
    service = AnalysisService(repository, StubTemplateRepository())

    service.delete_analysis(1, 1)

    assert repository.deleted_analysis is not None
    assert service.today_analysis_count(1)["count"] == 1
    assert service.list_analyses(1) == []


def test_today_analysis_count_exposes_llm_enabled(monkeypatch) -> None:
    service = AnalysisService(StubAnalysisRepository(), StubTemplateRepository())
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", False)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT_WHEN_LLM_DISABLED", 5)

    result = service.today_analysis_count(1)

    assert result["llm_enabled"] is False
    assert result["limit"] == 5


def test_create_analysis_uses_disabled_llm_limit(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.analyses = [
        SimpleNamespace(id=1, user_id=1, record_id=None, analysis_type="single", day_key=date.today(), created_at=datetime.now(UTC), content="a")
    ]
    service = AnalysisService(repository, StubTemplateRepository())
    monkeypatch.setattr(settings, "ANALYSIS_LLM_ENABLED", False)
    monkeypatch.setattr(settings, "DAILY_ANALYSIS_LIMIT_WHEN_LLM_DISABLED", 1)

    with pytest.raises(HTTPException) as exc:
        service.create_analysis(1, AnalysisCreate(record_id=None, content="new", day_key=date.today()))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Daily analysis limit reached (1)"


def test_generate_analysis_filters_records_by_template_and_persists_template_id(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    template_repository = StubTemplateRepository()
    template_repository.templates[11] = make_template(11, 1, "晨间复盘")
    repository.records = [
        make_record(1, 1, "x", template_id=11),
        make_record(2, 1, "y", template_id=11),
        make_record(3, 1, "z", template_id=22),
    ]
    llm_service = StubLLMAnalysisService("【分析范围】模板：晨间复盘\n总体趋势：稳定")
    service = AnalysisService(repository, template_repository, llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, template_id=11, range_months=0))

    assert result.template_id == 11
    assert "【分析范围】模板：晨间复盘" in result.content
    assert [record.id for record in llm_service.calls[0]["records"]] == [1, 2]
    assert llm_service.calls[0]["range_label"] == "模板：晨间复盘"


def test_generate_analysis_appends_rest_guidance_for_crisis_records(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    current_time = datetime.now(UTC)
    repository.records = [
        make_record(1, 1, "其他：还行", current_time),
        make_record(2, 1, "其他：好烦，不想动", current_time + timedelta(minutes=1)),
    ]
    llm_service = StubLLMAnalysisService("【分析范围】全部\n总体趋势：今天波动较大。")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(service.weather_service, "get_current_snapshot", lambda: None)

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert "请先休息" in result.content
    assert "喝水" in result.content


def test_generate_analysis_appends_sunlight_guidance_when_weather_matches(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    current_time = datetime.now(UTC)
    repository.records = [
        make_record(1, 1, "其他：还行", current_time),
        make_record(2, 1, "其他：好烦", current_time + timedelta(minutes=1)),
    ]
    llm_service = StubLLMAnalysisService("【分析范围】全部\n总体趋势：今天波动较大。")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(
        service.weather_service,
        "get_current_snapshot",
        lambda: WeatherSnapshot(location_label="上海", is_sunny=True, is_daylight=True, weather_code=0),
    )

    result = service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    assert "晒晒太阳" in result.content
