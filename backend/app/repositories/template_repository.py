from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.template import Template


class TemplateRepository:
    """封装模板相关的数据库查询和修改。"""
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Template]:
        """返回模板列表，默认模板排在最前面。"""
        statement = (
            select(Template)
            .where(Template.user_id == user_id)
            .order_by(Template.is_default.desc(), Template.updated_at.desc(), Template.id.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id_for_user(self, template_id: int, user_id: int) -> Template | None:
        statement = select(Template).where(
            Template.id == template_id,
            Template.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_source_id_for_user(self, user_id: int, source_template_id: int) -> Template | None:
        statement = select(Template).where(
            Template.user_id == user_id,
            Template.source_template_id == source_template_id,
        )
        return self.db.scalar(statement)

    def clear_default_for_user(self, user_id: int) -> None:
        """清空某个用户全部模板的默认标记。"""
        self.db.execute(
            update(Template)
            .where(Template.user_id == user_id)
            .values(is_default=False)
        )

    def create(
        self,
        user_id: int,
        title: str,
        content: str,
        is_default: bool,
        created_at=None,
        updated_at=None,
        source_template_id: int | None = None,
    ) -> Template:
        """插入新模板，并刷新数据库生成的字段。"""
        template = Template(
            user_id=user_id,
            source_template_id=source_template_id,
            title=title,
            content=content,
            is_default=is_default,
            created_at=created_at,
            updated_at=updated_at,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def update(self, template: Template, title: str, content: str, is_default: bool) -> Template:
        """持久化已有模板的内容和默认状态变更。"""
        template.title = title
        template.content = content
        template.is_default = is_default
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def delete(self, template: Template) -> None:
        """永久删除一条模板。"""
        self.db.delete(template)
        self.db.commit()
