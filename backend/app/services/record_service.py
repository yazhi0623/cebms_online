from fastapi import HTTPException, status

from app.models.record import Record
from app.repositories.record_repository import RecordRepository
from app.repositories.template_repository import TemplateRepository
from app.schemas.record import RecordCreate, RecordUpdate


class RecordService:
    """协调记录持久化，并负责归属校验。"""
    def __init__(self, record_repository: RecordRepository, template_repository: TemplateRepository) -> None:
        self.record_repository = record_repository
        self.template_repository = template_repository

    def list_records(self, user_id: int) -> list[Record]:
        """返回某个用户的全部记录。"""
        return self.record_repository.list_by_user(user_id)

    def create_record(self, user_id: int, record_in: RecordCreate) -> Record:
        """为指定用户创建一条新记录。"""
        template_id = self._resolve_template_id(user_id, record_in.template_id)
        return self.record_repository.create(
            user_id=user_id,
            title=record_in.title,
            content=record_in.content,
            template_id=template_id,
        )

    def get_record(self, record_id: int, user_id: int) -> Record:
        """获取记录，并把不存在或越权访问统一转成 404。"""
        record = self.record_repository.get_by_id_for_user(record_id, user_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found",
            )
        return record

    def update_record(self, record_id: int, user_id: int, record_in: RecordUpdate) -> Record:
        """在校验归属后更新已有记录。"""
        record = self.get_record(record_id, user_id)
        template_id = self._resolve_template_id(user_id, record_in.template_id)
        return self.record_repository.update(record, record_in.title, record_in.content, template_id)

    def delete_record(self, record_id: int, user_id: int) -> None:
        """在校验归属后删除已有记录。"""
        record = self.get_record(record_id, user_id)
        self.record_repository.delete(record)

    def _resolve_template_id(self, user_id: int, template_id: int | None) -> int | None:
        if template_id is None:
            return None

        template = self.template_repository.get_by_id_for_user(template_id, user_id)
        if template is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return template.id
