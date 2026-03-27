from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser, DBSession
from app.api.request_utils import get_client_ip
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import RefreshTokenRequest, Token, UserCreate, UserLogin, UserRead
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: DBSession) -> User:
    """旧版认证路由，直接在 endpoint 内部构造服务。"""
    service = AuthService(UserRepository(db))
    return service.register(user_in)


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, request: Request, db: DBSession) -> Token:
    """旧版登录入口。"""
    service = AuthService(UserRepository(db))
    return service.login(user_in, client_key=get_client_ip(request))


@router.get("/me", response_model=UserRead)
def read_me(current_user: CurrentUser) -> User:
    """返回当前登录用户。"""
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_token(token_in: RefreshTokenRequest, db: DBSession) -> Token:
    """刷新令牌。"""
    service = AuthService(UserRepository(db))
    return service.refresh_token(token_in)


@router.post("/logout")
def logout(current_user: CurrentUser, db: DBSession) -> dict[str, str]:
    """退出登录并撤销当前用户令牌。"""
    return AuthService(UserRepository(db)).logout(current_user)
