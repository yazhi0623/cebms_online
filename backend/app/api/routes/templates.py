from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DBSession
from app.models.template import Template
from app.repositories.template_repository import TemplateRepository
from app.schemas.template import TemplateCreate, TemplateRead, TemplateUpdate
from app.services.template_service import TemplateService

router = APIRouter()


@router.get("", response_model=list[TemplateRead])
def list_templates(db: DBSession, current_user: CurrentUser) -> list[Template]:
    """旧版模板列表入口。"""
    service = TemplateService(TemplateRepository(db))
    return service.list_templates(current_user.id)


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(template_in: TemplateCreate, db: DBSession, current_user: CurrentUser) -> Template:
    """旧版创建模板入口。"""
    service = TemplateService(TemplateRepository(db))
    return service.create_template(current_user.id, template_in)


@router.put("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: int,
    template_in: TemplateUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> Template:
    """旧版更新模板入口。"""
    service = TemplateService(TemplateRepository(db))
    return service.update_template(template_id, current_user.id, template_in)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, db: DBSession, current_user: CurrentUser) -> Response:
    """旧版删除模板入口。"""
    service = TemplateService(TemplateRepository(db))
    service.delete_template(template_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
