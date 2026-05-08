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
        db_tagline = "零配置嵌入式关系型数据库，适合本地开发与测试"
        db_features = [
            "DB_DRIVER=sqlite 一键切换，无需部署独立数据库服务",
            "SQLAlchemy 抽象层使同一领域代码在 SQLite / PostgreSQL 间无缝切换",
            "WAL 模式支持并发读写，满足本地开发与 CI 验证场景",
        ]
        summary = (
            "基于 Python + FastAPI 构建，Pydantic v2 严格验证请求/响应，"
            "SQLAlchemy 抽象层屏蔽 SQLite / PostgreSQL 差异，"
            "依赖注入提供 DB session、当前用户等上下文，JWT 双令牌鉴权。"
        )
    else:
        db_tagline = "功能丰富的开源关系型数据库，号称「最先进的开源数据库」"
        db_features = [
            "ACID 事务保障 favorite_count 反规范化计数的写入一致性",
            "refresh_tokens 表以 family_id + revoked 实现令牌族追踪，防重放攻击",
            "DB_DRIVER 环境变量热切换 SQLite/PostgreSQL，无需修改业务代码",
        ]
        summary = (
            "基于 Python + FastAPI 构建，Pydantic v2 严格验证请求/响应，"
            "SQLAlchemy + PostgreSQL 承载业务数据，Alembic 管理迁移，"
            "依赖注入提供 DB session、当前用户等上下文，JWT 双令牌鉴权。"
        )

    items = [
        StackItem(
            role="language", name="Python", version=py_ver,
            iconUrl="/static/icons/python.svg",
            tagline="以可读性为核心设计的动态语言，生态极为丰富",
            features=[
                "类型注解 + Pydantic v2 在运行时验证数据，兼顾灵活性与安全性",
                "asyncio 原生协程，FastAPI 全异步路由，无阻塞 I/O",
                "丰富的生态：SQLAlchemy、Alembic、httpx 等开箱即用",
            ],
        ),
        StackItem(
            role="framework", name="FastAPI", version=fastapi.__version__,
            iconUrl="/static/icons/fastapi.svg",
            tagline="基于类型注解自动生成 OpenAPI 文档的现代 Python Web 框架",
            features=[
                "路由装饰器 + Pydantic 模型自动校验入参、序列化响应",
                "依赖注入系统统一提供 DB session、当前用户、权限检查",
                "原生 async/await 支持，Uvicorn ASGI 服务器驱动",
            ],
        ),
        StackItem(
            role="database", name=db_name, version=db_ver,
            iconUrl=f"/static/icons/{db_name.lower()}.svg",
            tagline=db_tagline,
            features=db_features,
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
