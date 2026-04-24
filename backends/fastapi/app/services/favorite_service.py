"""收藏 / 取消收藏：维护 favorites 表与 capsules.favorite_count 的一致性。

关键约束：
  - favorite_count ± 1 与 favorites 行变更必须同事务
  - 并发安全：favorite_count 用 SQL 原子表达式（`favorite_count + 1`）避免读-改-写竞态
  - PG 额外用 SELECT ... FOR UPDATE；SQLite 依赖原子 UPDATE + WAL 写串行
  - 重复收藏：幂等（不报错，返回当前状态）
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import errors
from app.core.config import settings
from app.models import Capsule, Favorite, User
from app.schemas.capsule import FavoriteResult


def _load_capsule(db: Session, capsule_id: uuid.UUID, *, lock: bool) -> Capsule | None:
    stmt = select(Capsule).where(Capsule.id == capsule_id)
    if lock and settings.db_driver == "postgres":
        stmt = stmt.with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def add_favorite(db: Session, *, user: User, capsule_id: uuid.UUID) -> FavoriteResult:
    capsule = _load_capsule(db, capsule_id, lock=True)
    if not capsule or not capsule.in_plaza:
        raise errors.not_found("胶囊不存在")
    if capsule.owner_id == user.id:
        raise errors.bad_request("不能收藏自己创建的胶囊")

    existing = db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.capsule_id == capsule.id)
    ).scalar_one_or_none()
    if existing:
        return FavoriteResult(
            capsuleId=capsule.id,
            favoriteCount=capsule.favorite_count,
            favoritedAt=existing.created_at,
        )

    now = datetime.now(timezone.utc)
    db.add(Favorite(user_id=user.id, capsule_id=capsule.id, created_at=now))
    db.execute(
        update(Capsule)
        .where(Capsule.id == capsule.id)
        .values(favorite_count=Capsule.favorite_count + 1)
    )
    db.commit()
    db.refresh(capsule)
    return FavoriteResult(
        capsuleId=capsule.id, favoriteCount=capsule.favorite_count, favoritedAt=now
    )


def remove_favorite(db: Session, *, user: User, capsule_id: uuid.UUID) -> None:
    capsule = _load_capsule(db, capsule_id, lock=True)
    if not capsule:
        return
    existing = db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.capsule_id == capsule.id)
    ).scalar_one_or_none()
    if not existing:
        return
    db.delete(existing)
    db.execute(
        update(Capsule)
        .where(Capsule.id == capsule.id, Capsule.favorite_count > 0)
        .values(favorite_count=Capsule.favorite_count - 1)
    )
    db.commit()
