"""GET /health · GET /avatars"""

from __future__ import annotations

import sys
import time

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.avatar import Avatar
from app.schemas.common import Envelope
from app.schemas.health import HealthData, StackInfo, StackItem
from app.services.avatar_service import load_avatars

router = APIRouter(tags=["Health"])

_STARTED_AT = time.time()


def _build_stack() -> StackInfo:
    import fastapi

    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}"
    db_name = "PostgreSQL" if settings.db_driver == "postgres" else "SQLite"
    db_ver = "16" if settings.db_driver == "postgres" else "3"

    if db_name == "SQLite":
        summary = (
            "基于 Python + FastAPI 构建，Pydantic v2 严格验证请求/响应，"
            "SQLAlchemy 抽象层屏蔽 SQLite / PostgreSQL 差异，"
            "依赖注入提供 DB session、当前用户等上下文，JWT 双令牌鉴权。"
        )
    else:
        summary = (
            "基于 Python + FastAPI 构建，Pydantic v2 严格验证请求/响应，"
            "SQLAlchemy + PostgreSQL 承载业务数据，Alembic 管理迁移，"
            "依赖注入提供 DB session、当前用户等上下文，JWT 双令牌鉴权。"
        )

    items = [
        StackItem(
            role="language", name="Python", version=py_ver,
            iconUrl="/static/icons/python.svg",
        ),
        StackItem(
            role="framework", name="FastAPI", version=fastapi.__version__,
            iconUrl="/static/icons/fastapi.svg",
        ),
        StackItem(
            role="database", name=db_name, version=db_ver,
            iconUrl=f"/static/icons/{db_name.lower()}.svg",
        ),
    ]

    return StackInfo(kind="backend", summary=summary, items=items)


@router.get("/health", response_model=Envelope[HealthData])
def health() -> Envelope[HealthData]:
    data = HealthData(
        status="ok",
        service=settings.service_name,
        version=settings.service_version,
        uptimeSeconds=int(time.time() - _STARTED_AT),
        stack=_build_stack(),
    )
    return Envelope(success=True, data=data)


@router.get("/avatars", response_model=Envelope[list[Avatar]])
def avatars() -> Envelope[list[Avatar]]:
    return Envelope(success=True, data=load_avatars())
