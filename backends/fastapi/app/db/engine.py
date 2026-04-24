"""引擎工厂 + SQLite 兼容补丁。

差异点：
  - UUID：SQLAlchemy 2.0 `Uuid` 在 PG 用原生 UUID，在 SQLite 存 CHAR(32)
  - DateTime(timezone=True)：PG 原生 TIMESTAMPTZ；SQLite 存 ISO 字符串
  - CHECK / pg_trgm / GIN：仅 PG，SQLite 跳过（Alembic 迁移里用 dialect 分支）
  - 并发：SQLite 默认串行 + `BEGIN IMMEDIATE` 可满足 favorite_count 事务
"""

from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine

from app.core.config import settings


def build_engine() -> Engine:
    url = settings.db_url
    kwargs: dict = {"future": True, "pool_pre_ping": True}

    if settings.db_driver == "sqlite":
        # SQLite 在 FastAPI 的多线程场景下需要 check_same_thread=False
        kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_engine(url, **kwargs)

    if settings.db_driver == "sqlite":
        _apply_sqlite_pragmas(engine)

    return engine


def _apply_sqlite_pragmas(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()
