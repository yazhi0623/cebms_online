from fastapi import FastAPI
from fastapi import HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DBSession
from app.api.v1.router import router as api_router
from app.core.config import settings


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用实例。"""
    settings.validate_runtime_security()

    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.APP_DEBUG,
    )

    print(f"CEBMS CORS origins: {settings.cors_origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    if settings.trusted_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        if settings.SECURE_RESPONSE_HEADERS_ENABLED:
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("Referrer-Policy", "no-referrer")
            response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"])
    def healthcheck(db: DBSession) -> dict[str, str | int | bool]:
        """同时检查 API 进程和数据库是否可用。"""
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "status": "degraded",
                    "database": "unavailable",
                },
            ) from exc

        return {
            "status": "ok",
            "database": "ok",
            "toast_duration_ms": settings.TOAST_DURATION_MS,
            "auth_registration_enabled": settings.AUTH_REGISTRATION_ENABLED,
        }

    return app


app = create_app()
