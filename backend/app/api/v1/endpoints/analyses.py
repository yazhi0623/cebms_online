from fastapi import APIRouter, BackgroundTasks, Response, status
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import CurrentUser, DBSession
from app.api.deps.services import AnalysisServiceDep, AnalysisTaskServiceDep
from app.models.analysis import Analysis
from app.models.analysis_task import AnalysisTask
from app.schemas.analysis import AnalysisCreate, AnalysisGenerateRequest, AnalysisRead
from app.schemas.analysis_task import AnalysisTaskCreate, AnalysisTaskRead
from app.services.task_executor import run_analysis_task

router = APIRouter()


@router.get("", response_model=list[AnalysisRead])
def list_analyses(current_user: CurrentUser, service: AnalysisServiceDep) -> list[Analysis]:
    """返回当前用户已保存的分析记录。"""
    return service.list_analyses(current_user.id)


@router.get("/aggregate")
def aggregate_analyses(current_user: CurrentUser, service: AnalysisServiceDep) -> dict[str, str | int | None]:
    """返回分析页概览需要的聚合结果。"""
    return service.aggregate_analyses(current_user.id)


@router.get("/count/today")
def today_analysis_count(current_user: CurrentUser, service: AnalysisServiceDep) -> dict[str, int | str | bool]:
    """返回当前用户当天的分析配额使用情况。"""
    return service.today_analysis_count(current_user.id)


@router.post("/generate", response_model=AnalysisRead, status_code=status.HTTP_201_CREATED)
def generate_analysis(
    payload: AnalysisGenerateRequest,
    current_user: CurrentUser,
    service: AnalysisServiceDep,
) -> Analysis:
    """根据用户历史记录生成新的分析结果。"""
    return service.generate_analysis(current_user.id, payload, current_user)


@router.post("/tasks", response_model=AnalysisTaskRead, status_code=status.HTTP_201_CREATED)
def create_analysis_task(
    payload: AnalysisTaskCreate,
    background_tasks: BackgroundTasks,
    db: DBSession,
    current_user: CurrentUser,
    service: AnalysisTaskServiceDep,
) -> AnalysisTask:
    """创建分析后台任务，并交给后台执行器处理。"""
    task = service.create_task(current_user.id, payload)
    session_factory = sessionmaker(bind=db.get_bind(), class_=Session, autoflush=False, autocommit=False)
    background_tasks.add_task(run_analysis_task, session_factory, task.id)
    return task


@router.get("/tasks/{task_id}", response_model=AnalysisTaskRead)
def get_analysis_task(task_id: int, current_user: CurrentUser, service: AnalysisTaskServiceDep) -> AnalysisTask:
    """查询分析后台任务状态。"""
    return service.get_task(task_id, current_user.id)


@router.post("", response_model=AnalysisRead, status_code=status.HTTP_201_CREATED)
def create_analysis(analysis_in: AnalysisCreate, current_user: CurrentUser, service: AnalysisServiceDep) -> Analysis:
    """保存一条已经生成好的分析结果。"""
    return service.create_analysis(current_user.id, analysis_in)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: int, current_user: CurrentUser, service: AnalysisServiceDep) -> Response:
    """删除一条已保存的分析记录。"""
    service.delete_analysis(analysis_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
