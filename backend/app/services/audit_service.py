from app.repositories.audit_log_repository import AuditLogRepository


class AuditService:
    """把业务动作转成审计日志记录。"""

    def __init__(self, audit_log_repository: AuditLogRepository) -> None:
        self.audit_log_repository = audit_log_repository

    def log(
        self,
        user_id: int | None,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录一次用户动作，供后续排错或审计使用。"""
        self.audit_log_repository.create(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
        )
