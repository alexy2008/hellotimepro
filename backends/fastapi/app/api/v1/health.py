"""GET /health · GET /avatars"""

from __future__ import annotations

import sys
import time

import fastapi
import sqlalchemy
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.avatar import Avatar
from app.schemas.common import Envelope
from app.schemas.health import HealthData, StackInfo, StackItem
from app.services.avatar_service import load_avatars

router = APIRouter(tags=["Health"])

_STARTED_AT = time.time()


def _build_stack() -> StackInfo:
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}"
    db_name = "PostgreSQL" if settings.db_driver == "postgres" else "SQLite"
    db_ver = "16" if settings.db_driver == "postgres" else "3"
    items = [
        StackItem(role="language", name="Python", version=py_ver, iconUrl="/static/icons/python.svg"),
        StackItem(
            role="framework",
            name="FastAPI",
            version=fastapi.__version__,
            iconUrl="/static/icons/fastapi.svg",
        ),
        StackItem(
            role="database",
            name=db_name,
            version=db_ver,
            iconUrl=f"/static/icons/{db_name.lower()}.svg",
        ),
        StackItem(
            role="orm",
            name="SQLAlchemy",
            version=sqlalchemy.__version__,
            iconUrl=None,
        ),
    ]
    return StackInfo(kind="backend", items=items)


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
