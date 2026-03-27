from pathlib import Path

from fastapi import HTTPException, status

from app.models.export_task import ExportTask
from app.repositories.export_task_repository import ExportTaskRepository
from app.schemas.import_export import RecordExportCreate
from app.services.audit_service import AuditService


class ExportService:
    """负责导出任务的创建、查询、下载和删除。"""

    def __init__(self, export_task_repository: ExportTaskRepository, audit_service: AuditService | None = None) -> None:
        self.export_task_repository = export_task_repository
        self.audit_service = audit_service

    def list_exports(self, user_id: int) -> list[ExportTask]:
        """列出当前用户的导出任务。"""
        return self.export_task_repository.list_by_user(user_id)

    def create_export(self, user_id: int, payload: RecordExportCreate) -> ExportTask:
        """创建导出任务，实际生成文件由后台执行器完成。"""
        task = self.export_task_repository.create(user_id, payload.export_type, payload.format)
        if self.audit_service is not None:
            self.audit_service.log(user_id, "create", "export_task", str(task.id), f"type={payload.export_type}")
        return task

    def get_export_file_path(self, task_id: int, user_id: int) -> Path:
        """获取导出文件路径，并校验任务归属。"""
        task = self.export_task_repository.get_by_id_for_user(task_id, user_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export task not found")
        if not task.file_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found")

        path = Path(task.file_path)
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found")
        return path

    def delete_export(self, task_id: int, user_id: int) -> None:
        """删除导出任务，并清理磁盘上的导出文件。"""
        task = self.export_task_repository.get_by_id_for_user(task_id, user_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export task not found")

        file_path = Path(task.file_path) if task.file_path else None
        self.export_task_repository.delete(task)
        if file_path and file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)
        if self.audit_service is not None:
            self.audit_service.log(user_id, "delete", "export_task", str(task_id), "delete export task")
