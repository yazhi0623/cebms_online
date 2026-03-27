from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditLogRepository:
    """封装审计日志的数据库读写。"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        user_id: int | None,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        detail: str | None = None,
    ) -> AuditLog:
        """创建一条审计日志。"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_by_user(self, user_id: int) -> list[AuditLog]:
        """按时间倒序列出某个用户的审计日志。"""
        statement = (
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        )
        return list(self.db.scalars(statement).all())
