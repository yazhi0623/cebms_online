from fastapi import APIRouter, Query, Response, UploadFile, status
from fastapi.responses import Response as FastAPIResponse

from app.api.deps import CurrentUser
from app.api.deps.services import TemplateServiceDep
from app.models.template import Template
from app.schemas.template import TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter()


@router.get("", response_model=list[TemplateRead])
def list_templates(current_user: CurrentUser, service: TemplateServiceDep) -> list[Template]:
    """返回当前用户的全部模板。"""
    return service.list_templates(current_user.id)


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(template_in: TemplateCreate, current_user: CurrentUser, service: TemplateServiceDep) -> Template:
    """创建模板，并可选地把它设为默认模板。"""
    return service.create_template(current_user.id, template_in)


@router.put("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: int,
    template_in: TemplateUpdate,
    current_user: CurrentUser,
    service: TemplateServiceDep,
) -> Template:
    """在校验归属后更新指定模板。"""
    return service.update_template(template_id, current_user.id, template_in)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, current_user: CurrentUser, service: TemplateServiceDep) -> Response:
    """删除一条属于当前用户的模板。"""
    service.delete_template(template_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_templates(upload_file: UploadFile, current_user: CurrentUser, service: TemplateServiceDep) -> dict[str, int]:
    """直接从上传文件中导入模板。"""
    return await service.import_templates(current_user.id, upload_file)


@router.get("/export")
def export_templates(
    current_user: CurrentUser,
    service: TemplateServiceDep,
    format: str = Query(default="json"),
) -> FastAPIResponse:
    """按指定格式导出模板。"""
    file_name, content = service.export_templates(current_user.id, format)
    media_type = "text/plain; charset=utf-8"
    if format == "json":
        media_type = "application/json; charset=utf-8"
    elif format == "xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif format == "markdown":
        media_type = "text/markdown; charset=utf-8"

    return FastAPIResponse(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
