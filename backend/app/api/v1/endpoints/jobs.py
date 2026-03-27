from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser
from app.api.deps.services import JobServiceDep
from app.schemas.job import JobRead

router = APIRouter()


@router.get("", response_model=list[JobRead])
def list_jobs(current_user: CurrentUser, service: JobServiceDep) -> list[JobRead]:
    """返回聚合后的任务列表，前端数据中心页会统一展示。"""
    return service.list_jobs(current_user.id)


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, current_user: CurrentUser, service: JobServiceDep) -> JobRead:
    """查询单个任务详情。"""
    try:
        return service.get_job(current_user.id, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found") from exc
