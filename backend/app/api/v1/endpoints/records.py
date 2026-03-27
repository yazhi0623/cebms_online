from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser
from app.api.deps.services import RecordServiceDep
from app.models.record import Record
from app.schemas.record import RecordCreate, RecordRead, RecordUpdate

router = APIRouter()


@router.get("", response_model=list[RecordRead])
def list_records(current_user: CurrentUser, service: RecordServiceDep) -> list[Record]:
    """按展示顺序返回当前用户的记录列表。"""
    return service.list_records(current_user.id)


@router.post("", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
def create_record(record_in: RecordCreate, current_user: CurrentUser, service: RecordServiceDep) -> Record:
    """为当前登录用户创建一条新记录。"""
    return service.create_record(current_user.id, record_in)


@router.get("/{record_id}", response_model=RecordRead)
def get_record(record_id: int, current_user: CurrentUser, service: RecordServiceDep) -> Record:
    """读取一条属于当前用户的记录。"""
    return service.get_record(record_id, current_user.id)


@router.put("/{record_id}", response_model=RecordRead)
def update_record(
    record_id: int,
    record_in: RecordUpdate,
    current_user: CurrentUser,
    service: RecordServiceDep,
) -> Record:
    """在校验归属后更新指定记录。"""
    return service.update_record(record_id, current_user.id, record_in)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, current_user: CurrentUser, service: RecordServiceDep) -> Response:
    """删除一条属于当前用户的记录。"""
    service.delete_record(record_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
