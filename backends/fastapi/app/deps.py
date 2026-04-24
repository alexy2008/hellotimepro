"""FastAPI 依赖：数据库 session + 可选/必选当前用户。"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import errors, security
from app.db.session import get_db as _get_db
from app.models import User


def get_db() -> Iterator[Session]:
    yield from _get_db()


def _parse_bearer(auth: str | None) -> str | None:
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def current_user_optional(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    token = _parse_bearer(authorization)
    if not token:
        return None
    try:
        payload = security.decode_access_token(token)
    except security.AccessTokenError:
        return None
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()


def current_user_required(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _parse_bearer(authorization)
    if not token:
        raise errors.unauthorized("缺少 access token")
    try:
        payload = security.decode_access_token(token)
    except security.AccessTokenError as e:
        raise errors.unauthorized(e.reason) from e
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise errors.unauthorized("token payload 不合法") from e
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise errors.unauthorized("用户不存在")
    return user
