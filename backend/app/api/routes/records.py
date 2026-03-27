from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DBSession
from app.models.record import Record
from app.repositories.record_repository import RecordRepository
from app.schemas.record import RecordCreate, RecordRead, RecordUpdate
from app.services.record_service import RecordService

router = APIRouter()


@router.get("", response_model=list[RecordRead])
def list_records(db: DBSession, current_user: CurrentUser) -> list[Record]:
    """旧版记录列表入口。"""
    service = RecordService(RecordRepository(db))
    return service.list_records(current_user.id)


@router.post("", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
def create_record(record_in: RecordCreate, db: DBSession, current_user: CurrentUser) -> Record:
    """旧版创建记录入口。"""
    service = RecordService(RecordRepository(db))
    return service.create_record(current_user.id, record_in)


@router.get("/{record_id}", response_model=RecordRead)
def get_record(record_id: int, db: DBSession, current_user: CurrentUser) -> Record:
    """旧版读取单条记录入口。"""
    service = RecordService(RecordRepository(db))
    return service.get_record(record_id, current_user.id)


@router.put("/{record_id}", response_model=RecordRead)
def update_record(
    record_id: int,
    record_in: RecordUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> Record:
    """旧版更新记录入口。"""
    service = RecordService(RecordRepository(db))
    return service.update_record(record_id, current_user.id, record_in)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: DBSession, current_user: CurrentUser) -> Response:
    """旧版删除记录入口。"""
    service = RecordService(RecordRepository(db))
    service.delete_record(record_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
