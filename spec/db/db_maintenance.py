#!/usr/bin/env python3
"""Database maintenance commands for HelloTime Pro."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import SQLAlchemyError

from seed_demo import DEMO_EMAIL_MARKER, resolve_db_config, seed

HERE = Path(__file__).resolve().parent
PG_SCHEMA = HERE / "schema.sql"
SQLITE_SCHEMA = HERE / "schema.sqlite.sql"


def _sanitize(url: str) -> str:
    return re.sub(r":([^:@/]+)@", ":***@", url)


def _sqlite_path(db_url: str) -> Path:
    if not db_url.startswith("sqlite:///"):
        raise ValueError(f"不是 sqlite URL: {db_url}")
    return Path(db_url.removeprefix("sqlite:///"))


def _engine(db_driver: str, db_url: str):
    extra = {"check_same_thread": False} if db_driver == "sqlite" else {}
    engine = create_engine(db_url, connect_args=extra, future=True)
    if db_driver == "sqlite":
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection, _connection_record):
            dbapi_connection.execute("PRAGMA foreign_keys = ON")

    return engine


def _has_core_schema(db_driver: str, db_url: str) -> bool:
    if db_driver == "sqlite" and not _sqlite_path(db_url).exists():
        return False
    engine = _engine(db_driver, db_url)
    try:
        return inspect(engine).has_table("users")
    finally:
        engine.dispose()


def _exec_script(db_driver: str, db_url: str, script: str) -> None:
    engine = _engine(db_driver, db_url)
    try:
        if db_driver == "sqlite":
            with engine.begin() as conn:
                conn.connection.driver_connection.executescript(script)
        else:
            with engine.begin() as conn:
                with conn.connection.driver_connection.cursor() as cur:
                    cur.execute(script)
    finally:
        engine.dispose()


def init_schema(db_driver: str, db_url: str) -> None:
    if _has_core_schema(db_driver, db_url):
        print("↷  数据库 schema 已存在，跳过 init。")
        return
    if db_driver == "sqlite":
        db_file = _sqlite_path(db_url)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        schema = SQLITE_SCHEMA.read_text(encoding="utf-8")
    else:
        schema = PG_SCHEMA.read_text(encoding="utf-8")
    _exec_script(db_driver, db_url, schema)
    print("✓ 数据库 schema 初始化完成")


def _confirm_reset(yes: bool) -> None:
    if yes or not sys.stdin.isatty():
        return
    ans = input("⚠  即将重建数据库 schema，输入 yes 继续: ")
    if ans != "yes":
        print("已取消。")
        raise SystemExit(0)


def reset_schema(db_driver: str, db_url: str, *, yes: bool) -> None:
    _confirm_reset(yes)
    if db_driver == "sqlite":
        db_file = _sqlite_path(db_url)
        if db_file.exists():
            db_file.unlink()
        db_file.parent.mkdir(parents=True, exist_ok=True)
        print(f"↻ SQLite 已重置: {db_file}")
    else:
        _exec_script(
            db_driver,
            db_url,
            """
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
""",
        )
        print("↻ Postgres schema 已重置")
    init_schema(db_driver, db_url)


def seed_demo(db_driver: str, db_url: str, *, force: bool) -> None:
    if force:
        engine = _engine(db_driver, db_url)
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM users WHERE email LIKE :pat"),
                    {"pat": f"%@{DEMO_EMAIL_MARKER}"},
                )
        finally:
            engine.dispose()
    seed(db_driver, db_url)


def status(db_driver: str, db_url: str) -> None:
    print(f"DB_DRIVER = {db_driver}")
    print(f"DB_URL    = {_sanitize(db_url)}")
    print(f"schema    = {'present' if _has_core_schema(db_driver, db_url) else 'missing'}")


def main() -> int:
    parser = argparse.ArgumentParser(prog="scripts/db")
    parser.add_argument("command", choices=["init", "reset", "seed", "status"])
    parser.add_argument("--seed", action="store_true", help="reset 后导入演示数据")
    parser.add_argument("--force", action="store_true", help="seed 前先删除已有演示数据")
    parser.add_argument("--yes", "-y", action="store_true", help="跳过 reset 交互确认")
    args = parser.parse_args()

    db_driver, db_url = resolve_db_config()
    try:
        if args.command == "status":
            status(db_driver, db_url)
        elif args.command == "init":
            init_schema(db_driver, db_url)
        elif args.command == "reset":
            reset_schema(db_driver, db_url, yes=args.yes)
            if args.seed:
                seed_demo(db_driver, db_url, force=False)
        elif args.command == "seed":
            seed_demo(db_driver, db_url, force=args.force)
        return 0
    except (SQLAlchemyError, OSError, ValueError) as exc:
        print(f"✗ 数据库维护失败: {exc}", file=sys.stderr)
        print(f"  DB_DRIVER = {db_driver}", file=sys.stderr)
        print(f"  DB_URL    = {_sanitize(db_url)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
