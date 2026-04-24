"""自定义 SQLAlchemy 类型：解决 SQLite 读出裸 datetime 的问题。

PG 的 TIMESTAMPTZ 天然返回 tz-aware，SQLite 则把 tz-aware 写入后读回变成 naive。
UTCDateTime 在读时补上 UTC，保证上层比较始终是 aware。
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
