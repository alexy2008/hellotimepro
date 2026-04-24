"""Alembic 环境：从 app.core.config 读 DB_URL，复用同一 engine 工厂。"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context

from app.core.config import settings
from app.db.base import Base
from app.db.engine import build_engine
from app.models import Capsule, Favorite, RefreshToken, User  # noqa: F401  注册元数据

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

config.set_main_option("sqlalchemy.url", settings.db_url)


def run_migrations_offline() -> None:
    context.configure(
        url=settings.db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = build_engine()
    with engine.connect() as connection:
        context.configure(target_metadata=target_metadata, connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
