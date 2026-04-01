from datetime import UTC, datetime
from types import SimpleNamespace

from app.core.config import settings
from app.schemas.analysis import AnalysisGenerateRequest
from app.services.analysis_service import AnalysisService


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
    def __init__(self) -> None:
        self.analyses = []
        self.records = []

    def list_by_user(self, user_id: int):
        return [item for item in self.analyses if item.user_id == user_id]

    def count_all_by_user(self, user_id: int):
        return len([item for item in self.analyses if item.user_id == user_id])

    def count_billable_all_by_user(self, user_id: int):
        return len(
            [
                item
                for item in self.analyses
                if item.user_id == user_id
                and getattr(item, "source_analysis_id", None) is None
                and item.analysis_type != "batch_chunk"
            ]
        )

    def count_billable_by_user_and_day(self, user_id: int, day_key):
        return len(
            [
                item
                for item in self.analyses
                if item.user_id == user_id
                and item.day_key == day_key
                and getattr(item, "source_analysis_id", None) is None
                and item.analysis_type != "batch_chunk"
            ]
        )

    def list_by_user_and_day(self, user_id: int, day_key):
        return [item for item in self.analyses if item.user_id == user_id and item.day_key == day_key]

    def list_records_for_user(self, user_id: int):
        return [item for item in self.records if item.user_id == user_id]

    def get_record_for_user(self, record_id: int, user_id: int):
        for record in self.records:
            if record.id == record_id and record.user_id == user_id:
                return record
        return None

    def create(self, user_id, record_id, template_id, analysis_type, content, day_key, created_at=None, source_analysis_id=None):
        del created_at, source_analysis_id
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
        return analysis

    def commit_refresh(self, analysis):
        return analysis

    def get_by_id_for_user(self, analysis_id: int, user_id: int):
        for analysis in self.analyses:
            if analysis.id == analysis_id and analysis.user_id == user_id:
                return analysis
        return None

    def delete(self, analysis):
        self.analyses.remove(analysis)


class StubTemplateRepository:
    def get_by_id_for_user(self, template_id: int, user_id: int):
        del template_id, user_id
        return None


def make_record(record_id: int, user_id: int, content: str, created_at: datetime, updated_at: datetime):
    return SimpleNamespace(
        id=record_id,
        user_id=user_id,
        template_id=None,
        title=f"Record {record_id}",
        content=content,
        created_at=created_at,
        updated_at=updated_at,
    )


def test_generate_analysis_sorts_records_by_created_at_before_batching(monkeypatch) -> None:
    repository = StubAnalysisRepository()
    repository.records = [
        make_record(3, 1, "content 3", datetime(2026, 3, 3, 8, 0, tzinfo=UTC), datetime(2026, 3, 10, 8, 0, tzinfo=UTC)),
        make_record(1, 1, "content 1", datetime(2026, 3, 1, 8, 0, tzinfo=UTC), datetime(2026, 3, 11, 8, 0, tzinfo=UTC)),
        make_record(2, 1, "content 2", datetime(2026, 3, 2, 8, 0, tzinfo=UTC), datetime(2026, 3, 12, 8, 0, tzinfo=UTC)),
    ]

    llm_service = StubLLMAnalysisService("【分析范围】全部\n总体趋势：稳定")
    service = AnalysisService(repository, StubTemplateRepository(), llm_service)
    monkeypatch.setattr(settings, "ANALYSIS_THRESHOLD", 2)
    monkeypatch.setattr(service, "BATCH_SIZE", 2)

    service.generate_analysis(1, AnalysisGenerateRequest(record_id=None, range_months=0))

    first_chunk_ids = [record.id for record in llm_service.calls[0]["records"]]
    second_chunk_ids = [record.id for record in llm_service.calls[1]["records"]]
    assert first_chunk_ids == [1, 2]
    assert second_chunk_ids == [3]
    assert "2026-03-01 至 2026-03-02" in llm_service.calls[0]["range_label"]
