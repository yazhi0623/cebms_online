from sqlalchemy.orm import Session, sessionmaker
from fastapi import APIRouter, BackgroundTasks, Response, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DBSession
from app.api.deps.services import ExportServiceDep
from app.models.export_task import ExportTask
from app.schemas.import_export import RecordExportCreate, RecordExportRead
from app.services.task_executor import run_export_task

router = APIRouter()


@router.get("", response_model=list[RecordExportRead])
def list_exports(current_user: CurrentUser, service: ExportServiceDep) -> list[ExportTask]:
    """列出当前用户的导出任务。"""
    return service.list_exports(current_user.id)


@router.post("", response_model=RecordExportRead, status_code=status.HTTP_201_CREATED)
def create_export(
    payload: RecordExportCreate,
    background_tasks: BackgroundTasks,
    db: DBSession,
    current_user: CurrentUser,
    service: ExportServiceDep,
) -> ExportTask:
    """创建导出任务，并交给后台生成文件。"""
    task = service.create_export(current_user.id, payload)
    # 导出通常会读取较多数据，因此放在后台任务里执行更稳妥。
    session_factory = sessionmaker(bind=db.get_bind(), class_=Session, autoflush=False, autocommit=False)
    background_tasks.add_task(run_export_task, session_factory, task.id)
    return task


@router.get("/{task_id}/download")
def download_export_file(task_id: int, current_user: CurrentUser, service: ExportServiceDep) -> FileResponse:
    """下载已经生成好的导出文件。"""
    path = service.get_export_file_path(task_id, current_user.id)
    return FileResponse(path, filename=path.name)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_export(task_id: int, current_user: CurrentUser, service: ExportServiceDep) -> Response:
    """删除导出任务和对应文件。"""
    service.delete_export(task_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
