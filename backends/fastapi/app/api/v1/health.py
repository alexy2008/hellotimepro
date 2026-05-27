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

    summary = (
            "基于 Python + FastAPI + SQLAlchemy 核心骨架，选用 Pydantic 进行数据校验与 Schema 定义，"
            "Alembic 管理数据库迁移，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。"
            "依托 Python 的异步生态，搭配 Uvicorn 运行，提供高并发的请求处理性能，"
            "框架天然集成 OpenAPI 规范，可自动生成交互式 API 调试文档。"
            "接口边界上的输入与输出数据完全通过 Pydantic Schema 进行结构化声明与校验，"
            "在请求到达业务逻辑前即完成严格的字段校验与类型转换。"
            "SQLAlchemy ORM 配置了跨驱动连接池与方言支持，"
            "无需修改核心代码即可通过环境变量一键在 PostgreSQL 与 SQLite 之间无缝切换。"
            "项目严格遵循呈现层、应用层、领域层、基础设施层的经典四层架构，"
            "路由逻辑、数据校验、业务逻辑与数据模型各司其职，保证了极佳的模块化与可维护性。"
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
