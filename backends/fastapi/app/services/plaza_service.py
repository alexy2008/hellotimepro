"""广场列表 + "我创建的" / "我收藏的" 列表。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from math import ceil

from sqlalchemy import Select, and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core import errors
from app.models import Capsule, Favorite, User
from app.schemas.capsule import CapsuleListItem
from app.schemas.common import Paginated, Pagination
from app.schemas.user import UserBrief


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _apply_filter_opened(stmt: Select, filter_val: str) -> Select:
    now = _now()
    if filter_val == "opened":
        return stmt.where(Capsule.open_at <= now)
    if filter_val == "unopened":
        return stmt.where(Capsule.open_at > now)
    if filter_val == "all":
        return stmt
    raise errors.validation_error("filter 仅支持 all/opened/unopened", field="filter")


def _apply_query(stmt: Select, q: str | None) -> Select:
    if q is None:
        return stmt
    q_trim = q.strip()
    if not q_trim:
        return stmt
    if len(q_trim) > 50:
        raise errors.validation_error("q 长度不得超过 50", field="q")
    pattern = f"%{q_trim.lower()}%"
    return stmt.where(
        or_(func.lower(Capsule.title).like(pattern), func.lower(User.nickname).like(pattern))
    )


def _to_item(
    c: Capsule, owner: User, *, favorited_by_me: bool, favorited_at: datetime | None = None
) -> CapsuleListItem:
    return CapsuleListItem(
        id=c.id,
        code=c.code,
        title=c.title,
        creator=UserBrief(nickname=owner.nickname, avatarId=owner.avatar_id),
        openAt=c.open_at,
        createdAt=c.created_at,
        inPlaza=c.in_plaza,
        favoriteCount=c.favorite_count,
        isOpened=c.open_at <= _now(),
        favoritedByMe=favorited_by_me,
        favoritedAt=favorited_at,
    )


def _paginate(total: int, page: int, page_size: int) -> Pagination:
    return Pagination(
        page=page,
        pageSize=page_size,
        total=total,
        totalPages=ceil(total / page_size) if page_size else 0,
    )


def _favored_ids(
    db: Session, *, viewer_id: uuid.UUID | None, capsule_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    if viewer_id is None or not capsule_ids:
        return set()
    rows = db.execute(
        select(Favorite.capsule_id).where(
            Favorite.user_id == viewer_id, Favorite.capsule_id.in_(capsule_ids)
        )
    ).all()
    return {r[0] for r in rows}


def plaza_list(
    db: Session,
    *,
    sort: str,
    filter_val: str,
    q: str | None,
    page: int,
    page_size: int,
    viewer_id: uuid.UUID | None,
) -> Paginated[CapsuleListItem]:
    if sort not in ("hot", "new"):
        raise errors.validation_error("sort 仅支持 hot/new", field="sort")
    if page < 1:
        raise errors.validation_error("page 必须 >= 1", field="page")
    if page_size < 1 or page_size > 50:
        raise errors.validation_error("pageSize 范围 1-50", field="pageSize")

    base = select(Capsule, User).join(User, Capsule.owner_id == User.id).where(
        Capsule.in_plaza.is_(True)
    )
    base = _apply_filter_opened(base, filter_val)
    base = _apply_query(base, q)

    if sort == "hot":
        base = base.order_by(desc(Capsule.favorite_count), desc(Capsule.created_at))
    else:
        base = base.order_by(desc(Capsule.created_at))

    # count（从同样 where 子句派生）
    count_stmt = select(func.count()).select_from(
        base.order_by(None).subquery()
    )
    total = db.execute(count_stmt).scalar_one()

    rows = db.execute(base.offset((page - 1) * page_size).limit(page_size)).all()
    capsule_ids = [c.id for c, _ in rows]
    faved = _favored_ids(db, viewer_id=viewer_id, capsule_ids=capsule_ids)
    items = [_to_item(c, u, favorited_by_me=(c.id in faved)) for c, u in rows]
    return Paginated[CapsuleListItem](items=items, pagination=_paginate(total, page, page_size))


def my_capsules(
    db: Session, *, user: User, page: int, page_size: int
) -> Paginated[CapsuleListItem]:
    if page < 1:
        raise errors.validation_error("page 必须 >= 1", field="page")
    if page_size < 1 or page_size > 50:
        raise errors.validation_error("pageSize 范围 1-50", field="pageSize")

    base = (
        select(Capsule, User)
        .join(User, Capsule.owner_id == User.id)
        .where(Capsule.owner_id == user.id)
        .order_by(desc(Capsule.created_at))
    )
    total = db.execute(
        select(func.count()).select_from(Capsule).where(Capsule.owner_id == user.id)
    ).scalar_one()
    rows = db.execute(base.offset((page - 1) * page_size).limit(page_size)).all()
    # 自己的胶囊：favoritedByMe 恒 false（业务约束不允许收藏自己）
    items = [_to_item(c, u, favorited_by_me=False) for c, u in rows]
    return Paginated[CapsuleListItem](items=items, pagination=_paginate(total, page, page_size))


def my_favorites(
    db: Session, *, user: User, page: int, page_size: int
) -> Paginated[CapsuleListItem]:
    if page < 1:
        raise errors.validation_error("page 必须 >= 1", field="page")
    if page_size < 1 or page_size > 50:
        raise errors.validation_error("pageSize 范围 1-50", field="pageSize")

    base = (
        select(Capsule, User, Favorite.created_at)
        .join(Favorite, Favorite.capsule_id == Capsule.id)
        .join(User, Capsule.owner_id == User.id)
        .where(Favorite.user_id == user.id)
        .order_by(desc(Favorite.created_at))
    )
    total = db.execute(
        select(func.count()).select_from(Favorite).where(Favorite.user_id == user.id)
    ).scalar_one()
    rows = db.execute(base.offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        _to_item(c, u, favorited_by_me=True, favorited_at=fav_at) for c, u, fav_at in rows
    ]
    return Paginated[CapsuleListItem](items=items, pagination=_paginate(total, page, page_size))
