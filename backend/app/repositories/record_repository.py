from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.record import Record


class RecordRepository:
    """封装记录相关的数据库查询和修改。"""
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Record]:
        """按展示顺序返回某个用户的全部记录。"""
        statement = (
            select(Record)
            .where(Record.user_id == user_id)
            .order_by(Record.updated_at.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id_for_user(self, record_id: int, user_id: int) -> Record | None:
        """只有当记录属于该用户时才返回。"""
        statement = select(Record).where(
            Record.id == record_id,
            Record.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_id(self, record_id: int) -> Record | None:
        return self.db.get(Record, record_id)

    def get_by_source_id_for_user(self, user_id: int, source_record_id: int) -> Record | None:
        statement = select(Record).where(
            Record.user_id == user_id,
            Record.source_record_id == source_record_id,
        )
        return self.db.scalar(statement)

    def create(
        self,
        user_id: int,
        title: str,
        content: str,
        template_id: int | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        source_record_id: int | None = None,
    ) -> Record:
        """插入新记录，并返回刷新后的 ORM 对象。"""
        record = Record(
            user_id=user_id,
            source_record_id=source_record_id,
            template_id=template_id,
            title=title,
            content=content,
            created_at=created_at,
            updated_at=updated_at,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update(self, record: Record, title: str, content: str, template_id: int | None = None) -> Record:
        """持久化已有记录的标题和正文变更。"""
        record.title = title
        record.content = content
        record.template_id = template_id
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete(self, record: Record) -> None:
        """永久删除一条记录。"""
        self.db.delete(record)
        self.db.commit()
