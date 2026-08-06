"""自定义 SQLAlchemy 类型：解决 SQLite 读出裸 datetime 的问题。

PG 的 TIMESTAMPTZ 天然返回 tz-aware，SQLite 则把 tz-aware 写入后读回变成 naive。
UTCDateTime 在读时补上 UTC，保证上层比较始终是 aware。
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.types import TypeDecorator


def sqlite_utc_timestamp(value: datetime) -> str:
    """与 spec/db/seed_demo.py 一致的可按字典序比较的 UTC 文本。"""
    normalized = (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )
    base = normalized.strftime("%Y-%m-%dT%H:%M:%S")
    if normalized.microsecond:
        base += "." + f"{normalized.microsecond:06d}".rstrip("0")
    return base + "+00:00"


class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        # SQLite 的 DATETIME 实际以文本比较；改用 String impl，避免 SQLAlchemy
        # 默认写出空格分隔的 `YYYY-MM-DD HH:MM:SS.ffffff`。
        if dialect.name == "sqlite":
            return dialect.type_descriptor(String())
        return dialect.type_descriptor(DateTime(timezone=True))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "sqlite":
            return sqlite_utc_timestamp(value)
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
