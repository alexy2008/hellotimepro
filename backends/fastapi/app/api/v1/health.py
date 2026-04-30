"""GET /health · GET /avatars"""

from __future__ import annotations

import json
import sys
import time

import fastapi
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.avatar import Avatar
from app.schemas.common import Envelope
from app.schemas.health import HealthData, StackInfo, StackItem
from app.services.avatar_service import load_avatars

router = APIRouter(tags=["Health"])

_STARTED_AT = time.time()
_TECH_META: dict = {}


def _load_tech_meta() -> None:
    global _TECH_META
    path = settings.icons_source_dir.parent / "tech-meta.json"
    if path.exists():
        _TECH_META = json.loads(path.read_text(encoding="utf-8"))


_load_tech_meta()


def _meta(name: str) -> tuple[str | None, list[str] | None]:
    entry = _TECH_META.get(name)
    if not entry:
        return None, None
    return entry.get("tagline"), entry.get("features")


def _build_stack() -> StackInfo:
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}"
    db_name = "PostgreSQL" if settings.db_driver == "postgres" else "SQLite"
    db_ver = "16" if settings.db_driver == "postgres" else "3"

    defs = [
        ("language", "Python", py_ver, "/static/icons/python.svg"),
        ("framework", "FastAPI", fastapi.__version__, "/static/icons/fastapi.svg"),
        ("database", db_name, db_ver, f"/static/icons/{db_name.lower()}.svg"),
    ]
    items = []
    for role, name, version, icon_url in defs:
        tagline, features = _meta(name)
        items.append(StackItem(role=role, name=name, version=version, iconUrl=icon_url, tagline=tagline, features=features))
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
