"""用户资料读写。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import errors
from app.models import User
from app.schemas.user import UpdateProfileRequest, UserOut
from app.services.avatar_service import allowed_avatar_ids


def to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, nickname=u.nickname, avatarId=u.avatar_id, createdAt=u.created_at
    )


def update_profile(db: Session, *, user: User, req: UpdateProfileRequest) -> UserOut:
    if req.nickname is not None and req.nickname != user.nickname:
        exists = db.execute(
            select(User).where(User.nickname == req.nickname, User.id != user.id)
        ).scalar_one_or_none()
        if exists:
            raise errors.conflict("昵称已被使用", field="nickname")
        user.nickname = req.nickname

    if req.avatarId is not None:
        if req.avatarId not in allowed_avatar_ids():
            raise errors.validation_error("头像 ID 不存在", field="avatarId")
        user.avatar_id = req.avatarId

    db.commit()
    db.refresh(user)
    return to_out(user)
