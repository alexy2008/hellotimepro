"""技术组合叙述生成。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.health import StackItem


class StackNarrationFrontend(BaseModel):
    name: str
    items: list[StackItem]


class StackNarrationBackend(BaseModel):
    kind: Literal["backend", "fullstack"]
    service: str
    version: str
    items: list[StackItem]


class StackNarrationRequest(BaseModel):
    frontend: StackNarrationFrontend
    backend: StackNarrationBackend
    locale: str = "zh-CN"


class StackNarration(BaseModel):
    title: str = Field(min_length=1)
    narrative: str = Field(min_length=1)
    generatedBy: str  # noqa: N815 - API contract uses camelCase.
    cached: bool = False
