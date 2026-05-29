"""胶囊 AI 推荐主题 DTO。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class CapsuleRecommendationItem(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    hint: str = Field(min_length=1, max_length=80)
    openInDays: int = Field(ge=1, le=3650)  # noqa: N815


class CapsuleRecommendationList(BaseModel):
    items: list[CapsuleRecommendationItem]
    generatedBy: str  # noqa: N815
    cached: bool = False
