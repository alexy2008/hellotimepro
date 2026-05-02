"""auth_service 单元测试：注册 / 登录 / refresh 轮转 / 家族撤销 / 改密。"""

from __future__ import annotations

import pytest

from app.core.errors import APIError, ErrorCode
from app.services import auth_service


def _reg(db, suffix="a"):
    return auth_service.register(
        db,
        email=f"user_{suffix}@test.com",
        password="pass1234",
        nickname=f"nick_{suffix}",
        avatar_id="neo",
    )


# ── 注册 ────────────────────────────────────────────────────────────────────


def test_register_returns_tokens(db):
    tokens = _reg(db)
    assert tokens.accessToken
    assert tokens.refreshToken
    assert tokens.user.email == "user_a@test.com"
    assert tokens.user.nickname == "nick_a"


def test_register_duplicate_email_raises(db):
    _reg(db, "dup")
    with pytest.raises(APIError) as exc:
        auth_service.register(
            db,
            email="user_dup@test.com",
            password="x",
            nickname="other_nick",
            avatar_id="neo",
        )
    assert exc.value.code == ErrorCode.CONFLICT


def test_register_duplicate_nickname_raises(db):
    _reg(db, "nn")
    with pytest.raises(APIError) as exc:
        auth_service.register(
            db,
            email="other@test.com",
            password="x",
            nickname="nick_nn",
            avatar_id="neo",
        )
    assert exc.value.code == ErrorCode.CONFLICT


def test_register_invalid_avatar_raises(db):
    with pytest.raises(APIError) as exc:
        auth_service.register(
            db,
            email="u@test.com",
            password="x",
            nickname="anick",
            avatar_id="nonexistent_avatar",
        )
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


# ── 登录 ────────────────────────────────────────────────────────────────────


def test_login_correct_credentials(db):
    _reg(db, "l")
    tokens = auth_service.login(db, email="user_l@test.com", password="pass1234")
    assert tokens.accessToken
    assert tokens.user.email == "user_l@test.com"


def test_login_wrong_password_raises(db):
    _reg(db, "wp")
    with pytest.raises(APIError) as exc:
        auth_service.login(db, email="user_wp@test.com", password="wrong")
    assert exc.value.code == ErrorCode.UNAUTHORIZED


def test_login_unknown_email_raises(db):
    with pytest.raises(APIError) as exc:
        auth_service.login(db, email="nobody@test.com", password="x")
    assert exc.value.code == ErrorCode.UNAUTHORIZED


# ── refresh 轮转 ─────────────────────────────────────────────────────────────


def test_refresh_returns_new_tokens(db):
    t1 = _reg(db, "rf")
    t2 = auth_service.refresh(db, raw_refresh=t1.refreshToken)
    assert t2.accessToken
    assert t2.refreshToken != t1.refreshToken


def test_refresh_old_token_revoked(db):
    t1 = _reg(db, "rv")
    auth_service.refresh(db, raw_refresh=t1.refreshToken)
    # 再次使用旧 token → 整族撤销
    with pytest.raises(APIError) as exc:
        auth_service.refresh(db, raw_refresh=t1.refreshToken)
    assert exc.value.code == ErrorCode.UNAUTHORIZED


def test_refresh_replay_revokes_family(db):
    """检测到 token 重放时，新 token 也应被吊销（整族撤销）。"""
    t1 = _reg(db, "rp")
    t2 = auth_service.refresh(db, raw_refresh=t1.refreshToken)
    # 重放旧 token → 整族撤销
    with pytest.raises(APIError):
        auth_service.refresh(db, raw_refresh=t1.refreshToken)
    # 新 token 也已被吊销
    with pytest.raises(APIError) as exc:
        auth_service.refresh(db, raw_refresh=t2.refreshToken)
    assert exc.value.code == ErrorCode.UNAUTHORIZED


def test_refresh_invalid_token_raises(db):
    with pytest.raises(APIError) as exc:
        auth_service.refresh(db, raw_refresh="not-a-real-token")
    assert exc.value.code == ErrorCode.UNAUTHORIZED


# ── 改密 ─────────────────────────────────────────────────────────────────────


def test_change_password_revokes_all_tokens(db):
    from sqlalchemy import select
    from app.models import RefreshToken, User

    tokens = _reg(db, "cp")
    user = db.execute(select(User).where(User.email == "user_cp@test.com")).scalar_one()
    auth_service.change_password(
        db, user=user, current_password="pass1234", new_password="new_pass_9"
    )
    # 改密后旧 refresh token 应已失效
    with pytest.raises(APIError) as exc:
        auth_service.refresh(db, raw_refresh=tokens.refreshToken)
    assert exc.value.code == ErrorCode.UNAUTHORIZED

    # DB 中该用户所有 token 应均被吊销
    active = db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ).scalars().all()
    assert active == []


def test_change_password_wrong_current_raises(db):
    tokens = _reg(db, "wcp")
    from sqlalchemy import select
    from app.models import User

    user = db.execute(select(User).where(User.email == "user_wcp@test.com")).scalar_one()
    with pytest.raises(APIError) as exc:
        auth_service.change_password(
            db, user=user, current_password="wrong_current", new_password="new_pass"
        )
    assert exc.value.code == ErrorCode.UNAUTHORIZED
