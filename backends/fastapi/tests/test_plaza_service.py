"""plaza_service 单元测试：排序 / 过滤 / 搜索 / 分页 / 我的列表 / 收藏列表。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import APIError, ErrorCode
from app.services import auth_service, capsule_service, favorite_service, plaza_service
from app.schemas.capsule import CreateCapsuleRequest


def _dt(seconds_from_now: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds_from_now)


def _make_user(db, suffix):
    auth_service.register(
        db,
        email=f"plz_{suffix}@test.com",
        password="pass1234",
        nickname=f"plznick_{suffix}",
        avatar_id="neo",
    )
    from sqlalchemy import select
    from app.models import User
    return db.execute(select(User).where(User.email == f"plz_{suffix}@test.com")).scalar_one()


def _make_capsule(db, owner, *, title="cap", in_plaza=True, open_at_seconds=3600):
    req = CreateCapsuleRequest(
        title=title,
        content="body",
        openAt=_dt(open_at_seconds),
        inPlaza=in_plaza,
    )
    return capsule_service.create(db, owner=owner, req=req)


def _plaza(db, **kwargs):
    defaults = dict(sort="new", filter_val="all", q=None, page=1, page_size=15, viewer_id=None)
    defaults.update(kwargs)
    return plaza_service.plaza_list(db, **defaults)


# ── 基础 ─────────────────────────────────────────────────────────────────────


def test_only_in_plaza_capsules_returned(db):
    owner = _make_user(db, "vis")
    _make_capsule(db, owner, title="public", in_plaza=True)
    _make_capsule(db, owner, title="private", in_plaza=False)

    result = _plaza(db)
    titles = [i.title for i in result.items]
    assert "public" in titles
    assert "private" not in titles


def test_empty_plaza_returns_zero(db):
    result = _plaza(db)
    assert result.pagination.total == 0
    assert result.items == []


# ── 排序 ─────────────────────────────────────────────────────────────────────


def test_sort_new_returns_newest_first(db):
    owner = _make_user(db, "snew")
    _make_capsule(db, owner, title="first")
    _make_capsule(db, owner, title="second")

    result = _plaza(db, sort="new")
    # 最新创建在前
    assert result.items[0].title == "second"
    assert result.items[1].title == "first"


def test_sort_hot_orders_by_favorite_count(db):
    owner = _make_user(db, "shot")
    fan = _make_user(db, "shot_fan")
    cold = _make_capsule(db, owner, title="cold")
    hot = _make_capsule(db, owner, title="hot")

    favorite_service.add_favorite(db, user=fan, capsule_id=hot.id)

    result = _plaza(db, sort="hot")
    assert result.items[0].title == "hot"
    assert result.items[1].title == "cold"


def test_invalid_sort_raises(db):
    with pytest.raises(APIError) as exc:
        _plaza(db, sort="bogus")
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


# ── 过滤 ─────────────────────────────────────────────────────────────────────


def test_filter_unopened(db):
    owner = _make_user(db, "filt")
    _make_capsule(db, owner, title="future", open_at_seconds=7200)
    # 无法直接插入过去时间胶囊（schema 限制），跳过 opened 过滤的正面测试

    result = _plaza(db, filter_val="unopened")
    assert all(not i.isOpened for i in result.items)


def test_filter_all_returns_everything(db):
    owner = _make_user(db, "fall")
    _make_capsule(db, owner, title="a")
    _make_capsule(db, owner, title="b")
    result = _plaza(db, filter_val="all")
    assert result.pagination.total == 2


def test_invalid_filter_raises(db):
    with pytest.raises(APIError) as exc:
        _plaza(db, filter_val="bogus")
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


# ── 搜索 ─────────────────────────────────────────────────────────────────────


def test_search_by_title(db):
    owner = _make_user(db, "srch")
    _make_capsule(db, owner, title="Hello World")
    _make_capsule(db, owner, title="Goodbye")

    result = _plaza(db, q="hello")
    assert len(result.items) == 1
    assert result.items[0].title == "Hello World"


def test_search_no_match_returns_empty(db):
    owner = _make_user(db, "srch2")
    _make_capsule(db, owner, title="something")

    result = _plaza(db, q="zzznomatch")
    assert result.pagination.total == 0


# ── 分页 ─────────────────────────────────────────────────────────────────────


def test_pagination_splits_pages(db):
    owner = _make_user(db, "page")
    for i in range(5):
        _make_capsule(db, owner, title=f"cap{i}")

    p1 = _plaza(db, page=1, page_size=3)
    p2 = _plaza(db, page=2, page_size=3)

    assert len(p1.items) == 3
    assert len(p2.items) == 2
    assert p1.pagination.total == 5
    assert p1.pagination.totalPages == 2


def test_invalid_page_raises(db):
    with pytest.raises(APIError) as exc:
        _plaza(db, page=0)
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


def test_invalid_page_size_raises(db):
    with pytest.raises(APIError) as exc:
        _plaza(db, page_size=100)
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


# ── 我的胶囊 ─────────────────────────────────────────────────────────────────


def test_my_capsules_only_own(db):
    owner = _make_user(db, "myc_owner")
    other = _make_user(db, "myc_other")
    _make_capsule(db, owner, title="mine")
    _make_capsule(db, other, title="theirs")

    result = plaza_service.my_capsules(db, user=owner, page=1, page_size=10)
    assert result.pagination.total == 1
    assert result.items[0].title == "mine"


def test_my_capsules_includes_private(db):
    owner = _make_user(db, "mycp")
    _make_capsule(db, owner, title="priv", in_plaza=False)
    _make_capsule(db, owner, title="pub", in_plaza=True)

    result = plaza_service.my_capsules(db, user=owner, page=1, page_size=10)
    titles = {i.title for i in result.items}
    assert titles == {"priv", "pub"}


# ── 我的收藏 ─────────────────────────────────────────────────────────────────


def test_my_favorites_returns_favorited(db):
    owner = _make_user(db, "myfav_owner")
    fan = _make_user(db, "myfav_fan")
    _make_capsule(db, owner, title="favorited")

    cap = _plaza(db).items[0]
    favorite_service.add_favorite(db, user=fan, capsule_id=cap.id)

    result = plaza_service.my_favorites(db, user=fan, page=1, page_size=10)
    assert result.pagination.total == 1
    assert result.items[0].title == "favorited"
    assert result.items[0].favoritedByMe is True


def test_my_favorites_empty_for_unfavorited(db):
    fan = _make_user(db, "myfav_empty")
    result = plaza_service.my_favorites(db, user=fan, page=1, page_size=10)
    assert result.pagination.total == 0
