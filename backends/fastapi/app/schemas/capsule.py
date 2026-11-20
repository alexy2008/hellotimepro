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
    contentPreview: str | None = None


class CapsuleDetail(CapsuleBase):
    content: str | None = None
    favoritedByMe: bool = False


def add_calendar_years(dt: datetime, years: int) -> datetime:
    """往后数若干个日历年的同一时刻；目标年没有该日期（2 月 29 日）时取当月最后一天。"""
    try:
        return dt.replace(year=dt.year + years)
    except ValueError:  # 只有 2 月 29 日会走到这里
        return dt.replace(year=dt.year + years, day=28)


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
        # 上限是「此刻往后 10 个日历年」（openapi 2.0.0），不是固定的 3650 天
        if v > add_calendar_years(now, 10):
            raise ValueError("openAt 不得超出当前时间 10 年")
        return v


class FavoriteRequest(BaseModel):
    capsuleId: uuid.UUID


class FavoriteResult(BaseModel):
    capsuleId: uuid.UUID
    favoriteCount: int
    favoritedAt: datetime


# ---------------------------------------------------------------- 统计（2.0）


class PlazaCounts(BaseModel):
    all: int
    opened: int
    unopened: int


class PlazaStats(BaseModel):
    counts: PlazaCounts
    farthestOpenAt: datetime | None
    nextOpenAt: datetime | None


class MyStats(BaseModel):
    created: int
    opened: int
    unopened: int
    inPlaza: int
    favoritesReceived: int
    favoritesGiven: int
