from app.models.backup_snapshot import BackupSnapshot
from app.models.export_task import ExportTask
from app.models.import_task import ImportTask
from app.repositories.backup_snapshot_repository import BackupSnapshotRepository
from app.repositories.export_task_repository import ExportTaskRepository
from app.repositories.import_task_repository import ImportTaskRepository
from app.schemas.job import JobRead


class JobService:
    """把导入、导出、备份三类任务统一整理给前端展示。"""

    def __init__(
        self,
        import_task_repository: ImportTaskRepository,
        export_task_repository: ExportTaskRepository,
        backup_snapshot_repository: BackupSnapshotRepository,
    ) -> None:
        self.import_task_repository = import_task_repository
        self.export_task_repository = export_task_repository
        self.backup_snapshot_repository = backup_snapshot_repository

    def list_jobs(self, user_id: int) -> list[JobRead]:
        """聚合三类任务并按创建时间倒序返回。"""
        jobs: list[JobRead] = []
        jobs.extend(self._to_import_job(item) for item in self.import_task_repository.list_by_user(user_id))
        jobs.extend(self._to_export_job(item) for item in self.export_task_repository.list_by_user(user_id))
        jobs.extend(self._to_backup_job(item) for item in self.backup_snapshot_repository.list_by_user(user_id))
        jobs.sort(key=lambda item: item.created_at, reverse=True)
        return jobs

    def get_job(self, user_id: int, job_id: str) -> JobRead:
        """从统一任务列表里查找单个任务。"""
        for item in self.list_jobs(user_id):
            if str(item.id) == job_id:
                return item
        raise ValueError(f"Job not found: {job_id}")

    @staticmethod
    def _to_import_job(item: ImportTask) -> JobRead:
        """把导入任务映射成统一的任务结构。"""
        return JobRead(
            id=item.id,
            type="record_import",
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    def _to_export_job(item: ExportTask) -> JobRead:
        """把导出任务映射成统一的任务结构。"""
        export_type = "analysis_export" if item.export_type == "analyses" else "record_export"
        return JobRead(
            id=item.id,
            type=export_type,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    def _to_backup_job(item: BackupSnapshot) -> JobRead:
        """把备份任务映射成统一的任务结构。"""
        return JobRead(
            id=item.id,
            type="backup_export",
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
