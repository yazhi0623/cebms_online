from fastapi import APIRouter

from app.api.v1.endpoints import analyses, auth, backups, exports, imports, jobs, records, templates

router = APIRouter()
# 这里统一注册 v1 的全部业务模块，main.py 只需要挂一次总路由即可。
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(records.router, prefix="/records", tags=["records"])
router.include_router(templates.router, prefix="/templates", tags=["templates"])
router.include_router(analyses.router, prefix="/analyses", tags=["analyses"])
router.include_router(imports.router, prefix="/imports", tags=["imports"])
router.include_router(exports.router, prefix="/exports", tags=["exports"])
router.include_router(backups.router, prefix="/backups", tags=["backups"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
