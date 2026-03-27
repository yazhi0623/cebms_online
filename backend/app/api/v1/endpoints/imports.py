from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.api.deps import CurrentUser, DBSession
from app.api.deps.services import ImportServiceDep
from app.core.config import settings
from app.core.upload_security import enforce_upload_size_limit
from app.models.import_task import ImportTask
from app.schemas.import_export import RecordImportCreate, RecordImportRead
from app.services.task_executor import run_import_task

router = APIRouter()


@router.get("/records", response_model=list[RecordImportRead])
def list_record_imports(current_user: CurrentUser, service: ImportServiceDep) -> list[ImportTask]:
    """列出当前用户的记录导入任务。"""
    return service.list_record_imports(current_user.id)


@router.post("/records", response_model=RecordImportRead, status_code=status.HTTP_201_CREATED)
async def create_record_import(
    request: Request,
    background_tasks: BackgroundTasks,
    db: DBSession,
    current_user: CurrentUser,
    service: ImportServiceDep,
) -> ImportTask:
    """创建记录导入任务，兼容 JSON 请求和 multipart 文件上传。"""
    content_type = request.headers.get("content-type", "")
    file_bytes: bytes | None = None

    if content_type.startswith("multipart/form-data"):
        # 新前端会走 multipart，把 source_type 和文件一起传进来。
        form = await request.form()
        source_type = str(form.get("source_type", "")).strip()
        upload_file = form.get("file")
        if not source_type:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="source_type is required")
        if not isinstance(upload_file, (UploadFile, StarletteUploadFile)):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="file is required")

        file_bytes = enforce_upload_size_limit(
            await upload_file.read(),
            settings.upload_max_file_size_bytes,
            label="Import file",
        )
        payload = RecordImportCreate(
            source_type=source_type,
            file_name=upload_file.filename or "imported-file",
        )
    else:
        # 老接口或测试代码可以直接传 JSON，只创建任务元数据。
        payload = RecordImportCreate.model_validate(await request.json())

    task = service.create_record_import(current_user.id, payload)
    session_factory = sessionmaker(bind=db.get_bind(), class_=Session, autoflush=False, autocommit=False)
    background_tasks.add_task(run_import_task, session_factory, task.id, file_bytes)
    return task


@router.get("/records/template/download")
def download_record_import_template(service: ImportServiceDep) -> FileResponse:
    """下载导入模板压缩包。"""
    path = service.build_record_import_template_zip()
    return FileResponse(path, filename=path.name, media_type="application/zip")


@router.get("/records/{task_id}/report")
def download_import_report(task_id: int, current_user: CurrentUser, service: ImportServiceDep) -> FileResponse:
    """下载导入失败报告。"""
    path = service.get_error_report_path(task_id, current_user.id)
    return FileResponse(path, filename=path.name, media_type="text/plain")


@router.delete("/records/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record_import(task_id: int, current_user: CurrentUser, service: ImportServiceDep) -> Response:
    """删除导入任务和错误报告。"""
    service.delete_record_import(task_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
