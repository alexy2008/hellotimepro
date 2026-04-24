"""健康检查 + 技术栈元数据。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class StackItem(BaseModel):
    role: str
    name: str
    version: str
    iconUrl: str | None = None


class StackInfo(BaseModel):
    kind: Literal["backend", "fullstack"]
    items: list[StackItem]


class HealthData(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    uptimeSeconds: int
    stack: StackInfo
