"""胶囊相关 DTO。"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserBrief


class CapsuleBase(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    creator: UserBrief
    openAt: datetime
    createdAt: datetime
    inPlaza: bool
    favoriteCount: int
    isOpened: bool


class CapsuleListItem(CapsuleBase):
    favoritedByMe: bool = False
    favoritedAt: datetime | None = None


class CapsuleDetail(CapsuleBase):
    content: str | None = None
    favoritedByMe: bool = False


class CreateCapsuleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=5000)
    openAt: datetime
    inPlaza: bool = True

    @field_validator("openAt")
    @classmethod
    def _open_at_bounds(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        # 归一：naive → 视为 UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v < now + timedelta(seconds=60):
            raise ValueError("openAt 必须晚于当前时间 60 秒以上")
        if v > now + timedelta(days=365 * 10):
            raise ValueError("openAt 不得超出当前时间 10 年")
        return v


class FavoriteRequest(BaseModel):
    capsuleId: uuid.UUID


class FavoriteResult(BaseModel):
    capsuleId: uuid.UUID
    favoriteCount: int
    favoritedAt: datetime
