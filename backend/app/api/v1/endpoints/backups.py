from sqlalchemy.orm import Session, sessionmaker
from fastapi import APIRouter, BackgroundTasks, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DBSession
from app.api.deps.services import BackupServiceDep
from app.models.backup_snapshot import BackupSnapshot
from app.schemas.backup import BackupCreate, BackupRead, BackupRestoreRead
from app.services.task_executor import run_backup_task

router = APIRouter()


@router.get("", response_model=list[BackupRead])
def list_backups(current_user: CurrentUser, service: BackupServiceDep) -> list[BackupSnapshot]:
    """列出当前用户的备份快照。"""
    return service.list_backups(current_user.id)


@router.post("", response_model=BackupRead, status_code=status.HTTP_201_CREATED)
def create_backup(
    payload: BackupCreate,
    background_tasks: BackgroundTasks,
    db: DBSession,
    current_user: CurrentUser,
    service: BackupServiceDep,
) -> BackupSnapshot:
    """创建备份任务，并把真正的打包工作放到后台执行。"""
    snapshot = service.create_backup(current_user.id, payload)
    # 后台任务需要独立 SessionFactory，避免复用请求生命周期里的数据库会话。
    session_factory = sessionmaker(bind=db.get_bind(), class_=Session, autoflush=False, autocommit=False)
    background_tasks.add_task(run_backup_task, session_factory, snapshot.id)
    return snapshot


@router.get("/{snapshot_id}/download")
def download_backup_file(snapshot_id: int, current_user: CurrentUser, service: BackupServiceDep) -> FileResponse:
    """下载指定备份文件。"""
    path = service.get_backup_file_path(snapshot_id, current_user.id)
    download_name = service.get_backup_download_name(snapshot_id, current_user.id, current_user.username)
    return FileResponse(path, filename=download_name, media_type="application/zip")


@router.post("/import", response_model=BackupRestoreRead, status_code=status.HTTP_201_CREATED)
async def import_backup(file: UploadFile, current_user: CurrentUser, service: BackupServiceDep) -> dict[str, int]:
    """上传备份压缩包并立即执行恢复。"""
    return await service.restore_backup(current_user.id, file)


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup(snapshot_id: int, current_user: CurrentUser, service: BackupServiceDep) -> Response:
    """删除备份任务和关联文件。"""
    service.delete_backup(snapshot_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
