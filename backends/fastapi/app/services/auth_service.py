"""鉴权：注册 / 登录 / refresh 轮转 / 登出 / 改密。

关键行为（对应 docs/02-design.md §7、01-requirements.md §4.1）：
  - refresh token 每次换新（rotate）+ family 延续
  - 使用已 revoked 的 token 触发整家族撤销
  - 改密码吊销该用户全部 refresh token
"""

from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from time import monotonic

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import errors, security
from app.core.config import settings
from app.models import RefreshToken, User
from app.schemas.user import AuthTokens, UserOut
from app.services.avatar_service import allowed_avatar_ids

# 简单内存限流：email → 最近失败时间戳队列
_login_failures: dict[str, deque[float]] = {}


def _rate_limit_login(email: str) -> None:
    bucket = _login_failures.setdefault(email.lower(), deque())
    now = monotonic()
    # 丢弃 60s 前的记录
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= settings.login_rate_limit_per_minute:
        raise errors.rate_limited()


def _record_login_failure(email: str) -> None:
    bucket = _login_failures.setdefault(email.lower(), deque())
    bucket.append(monotonic())


def _user_to_dto(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, nickname=u.nickname, avatarId=u.avatar_id, createdAt=u.created_at
    )


def _issue_token_pair(
    db: Session, user: User, *, family_id: uuid.UUID | None = None
) -> AuthTokens:
    access, access_ttl = security.create_access_token(
        user_id=user.id, nickname=user.nickname, avatar_id=user.avatar_id
    )
    raw_refresh = security.generate_refresh_token()
    token_hash = security.hash_refresh_token(raw_refresh)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.refresh_token_ttl_seconds)
    row = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id or uuid.uuid4(),
        expires_at=expires_at,
    )
    db.add(row)
    db.flush()
    return AuthTokens(
        accessToken=access,
        refreshToken=raw_refresh,
        accessTokenExpiresIn=access_ttl,
        refreshTokenExpiresIn=settings.refresh_token_ttl_seconds,
        user=_user_to_dto(user),
    )


def register(
    db: Session, *, email: str, password: str, nickname: str, avatar_id: str
) -> AuthTokens:
    if avatar_id not in allowed_avatar_ids():
        raise errors.validation_error("头像 ID 不存在", field="avatarId")

    email_norm = email.lower().strip()
    # 预检提示，精细冲突字段；并发场景下仍由 DB unique 兜底
    if db.execute(select(User).where(User.email == email_norm)).scalar_one_or_none():
        raise errors.conflict("邮箱已被注册", field="email")
    if db.execute(select(User).where(User.nickname == nickname)).scalar_one_or_none():
        raise errors.conflict("昵称已被使用", field="nickname")

    user = User(
        email=email_norm,
        password_hash=security.hash_password(password),
        nickname=nickname,
        avatar_id=avatar_id,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig).lower()
        if "email" in msg:
            raise errors.conflict("邮箱已被注册", field="email") from e
        if "nickname" in msg:
            raise errors.conflict("昵称已被使用", field="nickname") from e
        raise errors.conflict("注册冲突") from e

    tokens = _issue_token_pair(db, user)
    db.commit()
    return tokens


def login(db: Session, *, email: str, password: str) -> AuthTokens:
    email_norm = email.lower().strip()
    _rate_limit_login(email_norm)
    user = db.execute(select(User).where(User.email == email_norm)).scalar_one_or_none()
    if not user or not security.verify_password(password, user.password_hash):
        _record_login_failure(email_norm)
        raise errors.unauthorized("邮箱或密码错误")
    tokens = _issue_token_pair(db, user)
    db.commit()
    return tokens


def refresh(db: Session, *, raw_refresh: str) -> AuthTokens:
    token_hash = security.hash_refresh_token(raw_refresh)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    if settings.db_driver == "postgres":
        stmt = stmt.with_for_update()
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        raise errors.unauthorized("refresh token 无效")

    now = datetime.now(timezone.utc)
    if row.expires_at <= now:
        raise errors.unauthorized("refresh token 已过期")

    if row.revoked_at is not None:
        # 重放 → 整族作废
        db.query(RefreshToken).filter(
            RefreshToken.family_id == row.family_id, RefreshToken.revoked_at.is_(None)
        ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
        db.commit()
        raise errors.unauthorized("refresh token 已失效")

    user = db.execute(select(User).where(User.id == row.user_id)).scalar_one_or_none()
    if not user:
        raise errors.unauthorized("用户不存在")

    row.revoked_at = now
    db.flush()
    tokens = _issue_token_pair(db, user, family_id=row.family_id)
    db.commit()
    return tokens


def logout(db: Session, *, raw_refresh: str | None) -> None:
    if not raw_refresh:
        return
    token_hash = security.hash_refresh_token(raw_refresh)
    row = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()
    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()


def change_password(db: Session, *, user: User, current_password: str, new_password: str) -> None:
    if not security.verify_password(current_password, user.password_hash):
        raise errors.unauthorized("当前密码错误")
    user.password_hash = security.hash_password(new_password)
    # 吊销所有 refresh token
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
    ).update({RefreshToken.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
