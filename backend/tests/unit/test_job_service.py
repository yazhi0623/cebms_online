from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.services.job_service import JobService


class StubListRepository:
    def __init__(self, items):
        self.items = items

    def list_by_user(self, user_id: int):
        return [item for item in self.items if item.user_id == user_id]


def test_list_jobs_sorts_all_job_types_by_created_at_desc() -> None:
    now = datetime.now(UTC)
    import_repo = StubListRepository([SimpleNamespace(id=1, user_id=1, status="pending", created_at=now - timedelta(hours=3), updated_at=now - timedelta(hours=3))])
    export_repo = StubListRepository([SimpleNamespace(id=2, user_id=1, export_type="analyses", status="success", created_at=now - timedelta(hours=1), updated_at=now - timedelta(hours=1))])
    backup_repo = StubListRepository([SimpleNamespace(id=3, user_id=1, status="running", created_at=now - timedelta(hours=2), updated_at=now - timedelta(hours=2))])

    service = JobService(import_repo, export_repo, backup_repo)
    jobs = service.list_jobs(1)

    assert [job.id for job in jobs] == [2, 3, 1]
    assert jobs[0].type == "analysis_export"
    assert jobs[1].type == "backup_export"
    assert jobs[2].type == "record_import"


def test_get_job_raises_for_missing_job() -> None:
    service = JobService(StubListRepository([]), StubListRepository([]), StubListRepository([]))

    with pytest.raises(ValueError) as exc:
        service.get_job(1, "999")

    assert "Job not found: 999" in str(exc.value)
