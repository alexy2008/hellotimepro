from fastapi import APIRouter

from app.api.v1 import auth, capsules, favorites, health, me, plaza

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(me.router)
router.include_router(capsules.router)
router.include_router(plaza.router)
router.include_router(favorites.router)
