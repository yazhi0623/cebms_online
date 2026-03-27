from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.template import TemplateCreate, TemplateUpdate
from app.services.template_service import TemplateService


DETAIL_TITLE = "\u8bf7\u8f93\u5165\u6a21\u677f\u6807\u9898"
DETAIL_CONTENT = "\u8bf7\u8f93\u5165\u6a21\u677f\u5185\u5bb9"


class StubTemplateRepository:
    def __init__(self) -> None:
        self.templates: dict[int, SimpleNamespace] = {}
        self.clear_default_calls: list[int] = []
        self.deleted_template: SimpleNamespace | None = None

    def list_by_user(self, user_id: int):
        return [item for item in self.templates.values() if item.user_id == user_id]

    def clear_default_for_user(self, user_id: int) -> None:
        self.clear_default_calls.append(user_id)
        for item in self.templates.values():
            if item.user_id == user_id:
                item.is_default = False

    def create(self, user_id: int, title: str, content: str, is_default: bool):
        template = SimpleNamespace(
            id=len(self.templates) + 1,
            user_id=user_id,
            title=title,
            content=content,
            is_default=is_default,
        )
        self.templates[template.id] = template
        return template

    def get_by_id_for_user(self, template_id: int, user_id: int):
        template = self.templates.get(template_id)
        if template and template.user_id == user_id:
            return template
        return None

    def update(self, template, title: str, content: str, is_default: bool):
        template.title = title
        template.content = content
        template.is_default = is_default
        return template

    def delete(self, template) -> None:
        self.deleted_template = template
        self.templates.pop(template.id, None)


def test_validate_input_rejects_blank_fields() -> None:
    with pytest.raises(HTTPException) as title_exc:
        TemplateService.validate_input("   ", "content")
    with pytest.raises(HTTPException) as content_exc:
        TemplateService.validate_input("title", "   ")

    assert title_exc.value.detail == DETAIL_TITLE
    assert content_exc.value.detail == DETAIL_CONTENT


def test_create_template_clears_existing_default_when_needed() -> None:
    repository = StubTemplateRepository()
    service = TemplateService(repository)

    result = service.create_template(7, TemplateCreate(title="  title  ", content="  body  ", is_default=True))

    assert repository.clear_default_calls == [7]
    assert result.title == "title"
    assert result.content == "body"
    assert result.is_default is True


def test_update_template_raises_for_missing_template() -> None:
    repository = StubTemplateRepository()
    service = TemplateService(repository)

    with pytest.raises(HTTPException) as exc:
        service.update_template(99, 1, TemplateUpdate(title="t", content="c", is_default=False))

    assert exc.value.status_code == 404
    assert exc.value.detail == "Template not found"


def test_delete_template_removes_existing_template() -> None:
    repository = StubTemplateRepository()
    template = repository.create(3, "title", "content", False)
    service = TemplateService(repository)

    service.delete_template(template.id, 3)

    assert repository.deleted_template is template
    assert repository.templates == {}
