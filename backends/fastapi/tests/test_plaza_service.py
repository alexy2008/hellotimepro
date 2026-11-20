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


# ── 统计（2.0） ──────────────────────────────────────────────────────────────


def _open_now(db, capsule_id):
    """把一枚胶囊的开启时间拨到过去（创建接口不允许直接建已开启的）。"""
    from sqlalchemy import update
    from app.models import Capsule
    db.execute(update(Capsule).where(Capsule.id == capsule_id).values(created_at=_dt(-7200), open_at=_dt(-60)))
    db.commit()


def test_plaza_stats_counts_match_list_totals(db):
    owner = _make_user(db, "st_owner")
    a = _make_capsule(db, owner, title="星河 alpha", open_at_seconds=3600)
    _make_capsule(db, owner, title="星河 beta", open_at_seconds=7200)
    c = _make_capsule(db, owner, title="other", open_at_seconds=86400 * 400)
    _make_capsule(db, owner, title="private", in_plaza=False)
    _open_now(db, a.id)

    s = plaza_service.plaza_stats(db, q=None)
    assert (s.counts.all, s.counts.opened, s.counts.unopened) == (3, 1, 2)
    for f, n in (("all", 3), ("opened", 1), ("unopened", 2)):
        lst = plaza_service.plaza_list(db, sort="new", filter_val=f, q=None, page=1, page_size=20, viewer_id=None)
        assert lst.pagination.total == n
    assert s.farthestOpenAt is not None and abs((s.farthestOpenAt - c.openAt).total_seconds()) < 1
    assert s.nextOpenAt is not None and s.nextOpenAt > datetime.now(timezone.utc)

    sq = plaza_service.plaza_stats(db, q="星河")
    assert (sq.counts.all, sq.counts.opened, sq.counts.unopened) == (2, 1, 1)
    # 两个时刻不受 q 影响
    assert sq.farthestOpenAt == s.farthestOpenAt


def test_plaza_stats_empty_and_validation(db):
    s = plaza_service.plaza_stats(db, q=None)
    assert s.counts.all == 0 and s.farthestOpenAt is None and s.nextOpenAt is None
    with pytest.raises(APIError) as exc:
        plaza_service.plaza_stats(db, q="x" * 51)
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


def test_my_stats(db):
    me = _make_user(db, "ms_me")
    fan = _make_user(db, "ms_fan")
    a = _make_capsule(db, me, title="a")
    b = _make_capsule(db, me, title="b", in_plaza=False)
    other = _make_capsule(db, fan, title="theirs")
    _open_now(db, a.id)
    favorite_service.add_favorite(db, user=fan, capsule_id=a.id)
    favorite_service.add_favorite(db, user=me, capsule_id=b.id)
    favorite_service.add_favorite(db, user=me, capsule_id=other.id)

    s = plaza_service.my_stats(db, user=me)
    assert (s.created, s.opened, s.unopened, s.inPlaza) == (2, 1, 1, 1)
    assert s.favoritesReceived == 2  # a 被 fan 收藏一次，b 被自己收藏一次
    assert s.favoritesGiven == 2


# ── 2.0 复审修复 ──────────────────────────────────────────────────────────────


def test_query_is_literal_not_wildcard(db):
    """q 按字面子串匹配：% 与 _ 不是通配符。"""
    owner = _make_user(db, "lit_owner")
    _make_capsule(db, owner, title="axb 普通标题")
    _make_capsule(db, owner, title="a_b 带下划线")
    _make_capsule(db, owner, title="百分之百 100%")

    def titles(q):
        r = plaza_service.plaza_list(db, sort="new", filter_val="all", q=q, page=1, page_size=20, viewer_id=None)
        return sorted(i.title for i in r.items)

    # 注意：测试用户昵称形如 plznick_xxx，本身含 "_"，所以不单独搜 "_"
    assert titles("a_b") == ["a_b 带下划线"]  # 不会匹配 axb
    assert titles("%") == ["百分之百 100%"]  # 不会匹配全部
    assert plaza_service.plaza_stats(db, q="a_b").counts.all == 1
