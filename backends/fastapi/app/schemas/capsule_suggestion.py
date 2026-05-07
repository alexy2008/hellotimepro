"""胶囊 AI 生成建议 DTO。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CapsuleSuggestionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    locale: str = "zh-CN"


class CapsuleSuggestion(BaseModel):
    content: str = Field(min_length=1)
    openInDays: int = Field(ge=1, le=3650)  # noqa: N815
    openAt: datetime  # noqa: N815
    generatedBy: str  # noqa: N815
    cached: bool = False
