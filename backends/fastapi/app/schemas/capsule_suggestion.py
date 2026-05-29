"""胶囊 AI 生成建议 DTO。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CapsuleSuggestionRequest(BaseModel):
    # title 可选：留空（或不传）时由 AI 同时生成标题与正文。
    title: str | None = Field(default=None, max_length=60)
    locale: str = "zh-CN"


class CapsuleSuggestion(BaseModel):
    # 仅当请求未传 title（或为空白）时返回，供前端回填标题输入框。
    title: str | None = None
    content: str = Field(min_length=1)
    openInDays: int = Field(ge=1, le=3650)  # noqa: N815
    openAt: datetime  # noqa: N815
    generatedBy: str  # noqa: N815
    cached: bool = False
