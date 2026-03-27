from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser
from app.api.deps.services import AuthServiceDep
from app.api.request_utils import get_client_ip
from app.models.user import User
from app.schemas.user import RefreshTokenRequest, Token, UserCreate, UserLogin, UserRead

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, service: AuthServiceDep) -> User:
    """创建新用户账号。"""
    return service.register(user_in)


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, request: Request, service: AuthServiceDep) -> Token:
    """校验账号密码并返回访问令牌和刷新令牌。"""
    return service.login(user_in, client_key=get_client_ip(request))


@router.get("/me", response_model=UserRead)
def read_me(current_user: CurrentUser) -> User:
    """返回依赖注入解析出的当前登录用户。"""
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_token(token_in: RefreshTokenRequest, service: AuthServiceDep) -> Token:
    """使用有效刷新令牌重新签发一组新令牌。"""
    return service.refresh_token(token_in)


@router.post("/logout")
def logout(current_user: CurrentUser, service: AuthServiceDep) -> dict[str, str]:
    """撤销当前登录用户的访问令牌和刷新令牌。"""
    return service.logout(current_user)
