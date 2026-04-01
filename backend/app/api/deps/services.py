from typing import Annotated

from fastapi import Depends

from app.api.deps import DBSession
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.analysis_task_repository import AnalysisTaskRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.backup_snapshot_repository import BackupSnapshotRepository
from app.repositories.export_task_repository import ExportTaskRepository
from app.repositories.import_task_repository import ImportTaskRepository
from app.repositories.record_repository import RecordRepository
from app.repositories.template_repository import TemplateRepository
from app.repositories.user_repository import UserRepository
from app.services.analysis_service import AnalysisService
from app.services.analysis_task_service import AnalysisTaskService
from app.services.llm_analysis_service import LLMAnalysisService
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.backup_service import BackupService
from app.services.export_service import ExportService
from app.services.import_service import ImportService
from app.services.job_service import JobService
from app.services.record_service import RecordService
from app.services.template_service import TemplateService


def get_auth_service(db: DBSession) -> AuthService:
    """构造绑定当前数据库会话的认证服务。"""
    return AuthService(UserRepository(db))


def get_record_service(db: DBSession) -> RecordService:
    """构造绑定当前数据库会话的记录服务。"""
    return RecordService(RecordRepository(db), TemplateRepository(db))


def get_template_service(db: DBSession) -> TemplateService:
    """构造绑定当前数据库会话的模板服务。"""
    return TemplateService(TemplateRepository(db))


def get_analysis_service(db: DBSession) -> AnalysisService:
    """构造分析服务，并注入大模型适配器。"""
    return AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())


def get_analysis_task_service(db: DBSession) -> AnalysisTaskService:
    """构造分析后台任务服务。"""
    return AnalysisTaskService(AnalysisTaskRepository(db))


def get_audit_service(db: DBSession) -> AuditService:
    return AuditService(AuditLogRepository(db))


def get_import_service(db: DBSession, audit_service: Annotated[AuditService, Depends(get_audit_service)]) -> ImportService:
    return ImportService(ImportTaskRepository(db), audit_service)


def get_export_service(db: DBSession, audit_service: Annotated[AuditService, Depends(get_audit_service)]) -> ExportService:
    return ExportService(ExportTaskRepository(db), audit_service)


def get_backup_service(db: DBSession, audit_service: Annotated[AuditService, Depends(get_audit_service)]) -> BackupService:
    return BackupService(BackupSnapshotRepository(db), db, audit_service)


def get_job_service(db: DBSession) -> JobService:
    return JobService(
        ImportTaskRepository(db),
        ExportTaskRepository(db),
        BackupSnapshotRepository(db),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
RecordServiceDep = Annotated[RecordService, Depends(get_record_service)]
TemplateServiceDep = Annotated[TemplateService, Depends(get_template_service)]
AnalysisServiceDep = Annotated[AnalysisService, Depends(get_analysis_service)]
AnalysisTaskServiceDep = Annotated[AnalysisTaskService, Depends(get_analysis_task_service)]
ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
ExportServiceDep = Annotated[ExportService, Depends(get_export_service)]
BackupServiceDep = Annotated[BackupService, Depends(get_backup_service)]
JobServiceDep = Annotated[JobService, Depends(get_job_service)]
