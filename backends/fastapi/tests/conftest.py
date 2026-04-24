"""测试夹具：每个 session 用独立 SQLite 文件，跑完即删。"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEST_DB = BACKEND_ROOT / "_pytest.db"


@pytest.fixture(scope="session", autouse=True)
def _env():
    os.environ["DB_DRIVER"] = "sqlite"
    os.environ["DB_URL"] = f"sqlite:///{TEST_DB}"
    if TEST_DB.exists():
        TEST_DB.unlink()

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(cfg, "head")
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_between_tests():
    """每个测试前清空业务表（保留 schema）。"""
    from app.db.session import SessionLocal
    from app.models import Capsule, Favorite, RefreshToken, User

    db = SessionLocal()
    try:
        db.query(Favorite).delete()
        db.query(RefreshToken).delete()
        db.query(Capsule).delete()
        db.query(User).delete()
        db.commit()
    finally:
        db.close()
    yield
