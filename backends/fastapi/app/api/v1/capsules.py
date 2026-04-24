"""POST /capsules · GET /capsules/{code}"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.deps import current_user_optional, current_user_required, get_db
from app.models import User
from app.schemas.capsule import CapsuleDetail, CreateCapsuleRequest
from app.schemas.common import Envelope
from app.services import capsule_service

router = APIRouter(prefix="/capsules", tags=["Capsules"])


@router.post("", response_model=Envelope[CapsuleDetail], status_code=201)
def create_capsule(
    req: CreateCapsuleRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[CapsuleDetail]:
    data = capsule_service.create(db, owner=user, req=req)
    return Envelope(success=True, data=data)


@router.get("/{code}", response_model=Envelope[CapsuleDetail])
def get_by_code(
    code: str = Path(min_length=8, max_length=8),
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_optional),
) -> Envelope[CapsuleDetail]:
    data = capsule_service.get_by_code(
        db, code=code, viewer_id=(user.id if user else None)
    )
    return Envelope(success=True, data=data)
