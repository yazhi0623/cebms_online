# API 根路由直接复用 v1 路由，后续如果需要版本迁移可以在这里做分流。
from app.api.v1.router import router as api_router

