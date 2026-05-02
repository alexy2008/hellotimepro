"""capsule_service 单元测试：创建 / 按 code 查询 / 删除。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import APIError, ErrorCode
from app.services import auth_service, capsule_service
from app.schemas.capsule import CreateCapsuleRequest


def _future(seconds: int = 3600) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


def _make_user(db, suffix="a"):
    tokens = auth_service.register(
        db,
        email=f"cap_{suffix}@test.com",
        password="pass1234",
        nickname=f"capnick_{suffix}",
        avatar_id="neo",
    )
    from sqlalchemy import select
    from app.models import User
    return db.execute(select(User).where(User.email == f"cap_{suffix}@test.com")).scalar_one()


def _make_capsule(db, owner, *, title="Test Cap", in_plaza=True, seconds=3600):
    req = CreateCapsuleRequest(
        title=title,
        content="hello content",
        openAt=_future(seconds),
        inPlaza=in_plaza,
    )
    return capsule_service.create(db, owner=owner, req=req)


# ── 创建 ────────────────────────────────────────────────────────────────────


def test_create_returns_detail(db):
    owner = _make_user(db, "cr")
    detail = _make_capsule(db, owner)
    assert detail.title == "Test Cap"
    assert detail.code
    assert detail.isOpened is False  # 未来开启时间
    assert detail.content is None  # 密封中：内容对任何人隐藏


def test_create_code_is_uppercase_alphanum(db):
    owner = _make_user(db, "code")
    detail = _make_capsule(db, owner)
    assert re.fullmatch(r"[A-Z0-9]{8}", detail.code), f"bad code: {detail.code}"


def test_create_in_plaza_flag(db):
    owner = _make_user(db, "plaza")
    priv = _make_capsule(db, owner, in_plaza=False)
    pub = _make_capsule(db, owner, in_plaza=True, title="pub")
    assert priv.inPlaza is False
    assert pub.inPlaza is True


# ── get_by_code ──────────────────────────────────────────────────────────────


def test_get_by_code_found(db):
    owner = _make_user(db, "gc")
    created = _make_capsule(db, owner)
    fetched = capsule_service.get_by_code(db, code=created.code, viewer_id=owner.id)
    assert fetched.id == created.id
    assert fetched.title == "Test Cap"


def test_get_by_code_case_insensitive(db):
    owner = _make_user(db, "gci")
    created = _make_capsule(db, owner)
    lower_code = created.code.lower()
    fetched = capsule_service.get_by_code(db, code=lower_code, viewer_id=None)
    assert fetched.id == created.id


def test_get_by_code_not_found_raises(db):
    with pytest.raises(APIError) as exc:
        capsule_service.get_by_code(db, code="NOTEXIST", viewer_id=None)
    assert exc.value.code == ErrorCode.NOT_FOUND


def test_get_by_code_sealed_hides_content(db):
    owner = _make_user(db, "seal")
    created = _make_capsule(db, owner, seconds=7200)  # 2h future → sealed
    fetched = capsule_service.get_by_code(db, code=created.code, viewer_id=None)
    assert fetched.isOpened is False
    assert fetched.content is None


# ── delete_own ───────────────────────────────────────────────────────────────


def test_delete_own_removes_capsule(db):
    owner = _make_user(db, "del")
    created = _make_capsule(db, owner)
    capsule_service.delete_own(db, user=owner, capsule_id=created.id)
    with pytest.raises(APIError) as exc:
        capsule_service.get_by_code(db, code=created.code, viewer_id=None)
    assert exc.value.code == ErrorCode.NOT_FOUND


def test_delete_others_capsule_raises_forbidden(db):
    owner = _make_user(db, "doa")
    other = _make_user(db, "dob")
    created = _make_capsule(db, owner)
    with pytest.raises(APIError) as exc:
        capsule_service.delete_own(db, user=other, capsule_id=created.id)
    assert exc.value.code == ErrorCode.FORBIDDEN


def test_delete_nonexistent_raises_not_found(db):
    owner = _make_user(db, "dne")
    with pytest.raises(APIError) as exc:
        capsule_service.delete_own(db, user=owner, capsule_id=uuid.uuid4())
    assert exc.value.code == ErrorCode.NOT_FOUND
