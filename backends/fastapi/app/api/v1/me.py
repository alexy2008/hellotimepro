"""GET/PATCH /me · POST /me/password · GET /me/capsules · DELETE /me/capsules/{id}"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.deps import current_user_required, get_db
from app.models import User
from app.schemas.capsule import CapsuleListItem
from app.schemas.common import Envelope, Paginated
from app.schemas.user import ChangePasswordRequest, UpdateProfileRequest, UserOut
from app.services import auth_service, capsule_service, plaza_service, user_service

router = APIRouter(prefix="/me", tags=["Me"])


@router.get("", response_model=Envelope[UserOut])
def get_me(user: User = Depends(current_user_required)) -> Envelope[UserOut]:
    return Envelope(success=True, data=user_service.to_out(user))


@router.patch("", response_model=Envelope[UserOut])
def patch_me(
    req: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[UserOut]:
    out = user_service.update_profile(db, user=user, req=req)
    return Envelope(success=True, data=out)


@router.post("/password", status_code=204, response_class=Response)
def post_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Response:
    auth_service.change_password(
        db, user=user, current_password=req.currentPassword, new_password=req.newPassword
    )
    return Response(status_code=204)


@router.get("/capsules", response_model=Envelope[Paginated[CapsuleListItem]])
def get_my_capsules(
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[Paginated[CapsuleListItem]]:
    data = plaza_service.my_capsules(db, user=user, page=page, page_size=pageSize)
    return Envelope(success=True, data=data)


@router.delete("/capsules/{capsule_id}", status_code=204, response_class=Response)
def delete_my_capsule(
    capsule_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Response:
    capsule_service.delete_own(db, user=user, capsule_id=capsule_id)
    return Response(status_code=204)
