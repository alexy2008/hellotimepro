"""GET /plaza/capsules · GET /plaza/capsules/{id}"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import current_user_optional, get_db
from app.models import User
from app.schemas.capsule import CapsuleDetail, CapsuleListItem
from app.schemas.common import Envelope, Paginated
from app.services import capsule_service, plaza_service

router = APIRouter(prefix="/plaza", tags=["Plaza"])


@router.get("/capsules", response_model=Envelope[Paginated[CapsuleListItem]])
def plaza_list(
    sort: str = Query(default="new"),
    filter: str = Query(default="all"),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(current_user_optional),
) -> Envelope[Paginated[CapsuleListItem]]:
    data = plaza_service.plaza_list(
        db,
        sort=sort,
        filter_val=filter,
        q=q,
        page=page,
        page_size=pageSize,
        viewer_id=(viewer.id if viewer else None),
    )
    return Envelope(success=True, data=data)


@router.get("/capsules/{capsule_id}", response_model=Envelope[CapsuleDetail])
def plaza_detail(
    capsule_id: uuid.UUID,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(current_user_optional),
) -> Envelope[CapsuleDetail]:
    data = capsule_service.get_plaza_detail(
        db, capsule_id=capsule_id, viewer_id=(viewer.id if viewer else None)
    )
    return Envelope(success=True, data=data)
