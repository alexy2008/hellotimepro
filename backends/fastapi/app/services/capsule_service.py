"""胶囊：创建、按 code / id 查询、删除。"""

from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import errors
from app.models import Capsule, Favorite, User
from app.schemas.capsule import CapsuleDetail, CreateCapsuleRequest
from app.schemas.user import UserBrief

_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_opened(open_at: datetime) -> bool:
    return open_at <= _now()


def _to_detail(
    c: Capsule, owner: User, *, viewer_id: uuid.UUID | None, include_content: bool
) -> CapsuleDetail:
    opened = _is_opened(c.open_at)
    favorited_by_me = False
    if viewer_id is not None:
        # 小表，单次点查
        fav = (
            c._sa_instance_state.session.query(Favorite)
            .filter(Favorite.user_id == viewer_id, Favorite.capsule_id == c.id)
            .first()
            if c._sa_instance_state.session
            else None
        )
        favorited_by_me = fav is not None
    return CapsuleDetail(
        id=c.id,
        code=c.code,
        title=c.title,
        creator=UserBrief(nickname=owner.nickname, avatarId=owner.avatar_id),
        openAt=c.open_at,
        createdAt=c.created_at,
        inPlaza=c.in_plaza,
        favoriteCount=c.favorite_count,
        isOpened=opened,
        content=c.content if (opened and include_content) else None,
        favoritedByMe=favorited_by_me,
    )


def create(db: Session, *, owner: User, req: CreateCapsuleRequest) -> CapsuleDetail:
    # 最多 5 次重试码冲突
    last_err: IntegrityError | None = None
    for _ in range(5):
        code = _generate_code()
        capsule = Capsule(
            owner_id=owner.id,
            code=code,
            title=req.title,
            content=req.content,
            open_at=req.openAt,
            in_plaza=req.inPlaza,
            favorite_count=0,
        )
        db.add(capsule)
        try:
            db.flush()
            db.commit()
            db.refresh(capsule)
            return _to_detail(capsule, owner, viewer_id=owner.id, include_content=True)
        except IntegrityError as e:
            db.rollback()
            last_err = e
            continue
    raise errors.APIError(errors.ErrorCode.INTERNAL_ERROR, "生成唯一码失败") from last_err


def get_by_code(db: Session, *, code: str, viewer_id: uuid.UUID | None) -> CapsuleDetail:
    code_norm = code.upper()
    row = db.execute(
        select(Capsule, User).join(User, Capsule.owner_id == User.id).where(Capsule.code == code_norm)
    ).one_or_none()
    if not row:
        raise errors.not_found("胶囊不存在")
    capsule, owner = row
    return _to_detail(capsule, owner, viewer_id=viewer_id, include_content=True)


def get_plaza_detail(db: Session, *, capsule_id: uuid.UUID, viewer_id: uuid.UUID | None) -> CapsuleDetail:
    row = db.execute(
        select(Capsule, User)
        .join(User, Capsule.owner_id == User.id)
        .where(Capsule.id == capsule_id, Capsule.in_plaza.is_(True))
    ).one_or_none()
    if not row:
        raise errors.not_found("胶囊不存在")
    capsule, owner = row
    return _to_detail(capsule, owner, viewer_id=viewer_id, include_content=True)


def delete_own(db: Session, *, user: User, capsule_id: uuid.UUID) -> None:
    capsule = db.execute(select(Capsule).where(Capsule.id == capsule_id)).scalar_one_or_none()
    if not capsule:
        raise errors.not_found("胶囊不存在")
    if capsule.owner_id != user.id:
        raise errors.forbidden("无权删除他人胶囊")
    db.delete(capsule)
    db.commit()
