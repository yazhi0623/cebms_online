from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DBSession
from app.models.analysis import Analysis
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.template_repository import TemplateRepository
from app.schemas.analysis import AnalysisCreate, AnalysisGenerateRequest, AnalysisRead
from app.services.analysis_service import AnalysisService
from app.services.llm_analysis_service import LLMAnalysisService

router = APIRouter()


@router.get("", response_model=list[AnalysisRead])
def list_analyses(db: DBSession, current_user: CurrentUser) -> list[Analysis]:
    """旧版分析列表入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    return service.list_analyses(current_user.id)


@router.get("/aggregate")
def aggregate_analyses(db: DBSession, current_user: CurrentUser) -> dict[str, str | int]:
    """旧版分析聚合入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    return service.aggregate_analyses(current_user.id)


@router.get("/count/today")
def today_analysis_count(db: DBSession, current_user: CurrentUser) -> dict[str, int | str | bool]:
    """旧版今日分析次数统计入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    return service.today_analysis_count(current_user.id)


@router.post("/generate", response_model=AnalysisRead, status_code=status.HTTP_201_CREATED)
def generate_analysis(
    payload: AnalysisGenerateRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> Analysis:
    """旧版自动生成分析入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    return service.generate_analysis(current_user.id, payload, current_user)


@router.post("", response_model=AnalysisRead, status_code=status.HTTP_201_CREATED)
def create_analysis(analysis_in: AnalysisCreate, db: DBSession, current_user: CurrentUser) -> Analysis:
    """旧版手动创建分析入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    return service.create_analysis(current_user.id, analysis_in)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: int, db: DBSession, current_user: CurrentUser) -> Response:
    """旧版删除分析入口。"""
    service = AnalysisService(AnalysisRepository(db), TemplateRepository(db), LLMAnalysisService())
    service.delete_analysis(analysis_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
