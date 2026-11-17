"""favorite_service 单元测试：收藏 / 取消 / 幂等 / 2.0 不校验状态。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import APIError, ErrorCode
from app.services import auth_service, capsule_service, favorite_service
from app.schemas.capsule import CreateCapsuleRequest


def _future(seconds: int = 3600) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


def _make_user(db, suffix):
    auth_service.register(
        db,
        email=f"fav_{suffix}@test.com",
        password="pass1234",
        nickname=f"favnick_{suffix}",
        avatar_id="neo",
    )
    from sqlalchemy import select
    from app.models import User
    return db.execute(select(User).where(User.email == f"fav_{suffix}@test.com")).scalar_one()


def _make_capsule(db, owner, *, in_plaza=True):
    req = CreateCapsuleRequest(
        title="fav-cap",
        content="content",
        openAt=_future(3600),
        inPlaza=in_plaza,
    )
    detail = capsule_service.create(db, owner=owner, req=req)
    # 返回 UUID（detail.id 是 UUID）
    return detail.id


# ── 收藏 ────────────────────────────────────────────────────────────────────


def test_add_favorite_increments_count(db):
    owner = _make_user(db, "inc_owner")
    fan = _make_user(db, "inc_fan")
    cid = _make_capsule(db, owner)

    result = favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    assert result.favoriteCount == 1
    assert result.favoritedAt is not None


def test_add_favorite_idempotent(db):
    """重复收藏应返回当前状态而不报错，且计数不重复递增。"""
    owner = _make_user(db, "idem_owner")
    fan = _make_user(db, "idem_fan")
    cid = _make_capsule(db, owner)

    r1 = favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    r2 = favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    assert r1.favoriteCount == r2.favoriteCount == 1


def test_add_favorite_own_capsule_allowed(db):
    """2.0：可以收藏自己的胶囊，计数照常 +1。"""
    owner = _make_user(db, "own_fav")
    cid = _make_capsule(db, owner)
    result = favorite_service.add_favorite(db, user=owner, capsule_id=cid)
    assert result.favoriteCount == 1


def test_add_favorite_not_in_plaza_allowed(db):
    """2.0：未发布到广场的胶囊（凭码可见）也可以收藏。"""
    owner = _make_user(db, "nplaza_owner")
    fan = _make_user(db, "nplaza_fan")
    cid = _make_capsule(db, owner, in_plaza=False)
    result = favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    assert result.favoriteCount == 1


def test_add_favorite_missing_capsule_raises(db):
    import uuid
    fan = _make_user(db, "missing_fan")
    with pytest.raises(APIError) as exc:
        favorite_service.add_favorite(db, user=fan, capsule_id=uuid.uuid4())
    assert exc.value.code == ErrorCode.NOT_FOUND


def test_delete_capsule_removes_favorites(db):
    """删除胶囊连带删除所有收藏，它从收藏者的列表里消失。"""
    from app.services import plaza_service
    owner = _make_user(db, "del_owner")
    fan = _make_user(db, "del_fan")
    cid = _make_capsule(db, owner)
    favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    favorite_service.add_favorite(db, user=owner, capsule_id=cid)
    capsule_service.delete_own(db, user=owner, capsule_id=cid)
    assert plaza_service.my_favorites(db, user=fan, page=1, page_size=10).pagination.total == 0
    assert plaza_service.my_favorites(db, user=owner, page=1, page_size=10).pagination.total == 0


# ── 取消收藏 ─────────────────────────────────────────────────────────────────


def test_remove_favorite_decrements_count(db):
    owner = _make_user(db, "rm_owner")
    fan = _make_user(db, "rm_fan")
    cid = _make_capsule(db, owner)

    favorite_service.add_favorite(db, user=fan, capsule_id=cid)
    favorite_service.remove_favorite(db, user=fan, capsule_id=cid)

    from sqlalchemy import select
    from app.models import Capsule
    cap = db.execute(select(Capsule).where(Capsule.id == cid)).scalar_one()
    assert cap.favorite_count == 0


def test_remove_favorite_not_exists_is_silent(db):
    """取消一个不存在的收藏不应抛出异常。"""
    owner = _make_user(db, "rmne_owner")
    fan = _make_user(db, "rmne_fan")
    cid = _make_capsule(db, owner)
    # 从未收藏，直接取消 → 静默
    favorite_service.remove_favorite(db, user=fan, capsule_id=cid)


def test_multiple_fans_independent_counts(db):
    owner = _make_user(db, "mf_owner")
    fan1 = _make_user(db, "mf_fan1")
    fan2 = _make_user(db, "mf_fan2")
    cid = _make_capsule(db, owner)

    favorite_service.add_favorite(db, user=fan1, capsule_id=cid)
    r2 = favorite_service.add_favorite(db, user=fan2, capsule_id=cid)
    assert r2.favoriteCount == 2

    favorite_service.remove_favorite(db, user=fan1, capsule_id=cid)
    from sqlalchemy import select
    from app.models import Capsule
    cap = db.execute(select(Capsule).where(Capsule.id == cid)).scalar_one()
    assert cap.favorite_count == 1
