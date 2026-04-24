"""GET/POST /me/favorites · DELETE /me/favorites/{capsuleId}

路径前缀仍是 /me（避免和收藏本身的语义混淆），但归类在 Favorites tag。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.deps import current_user_required, get_db
from app.models import User
from app.schemas.capsule import CapsuleListItem, FavoriteRequest, FavoriteResult
from app.schemas.common import Envelope, Paginated
from app.services import favorite_service, plaza_service

router = APIRouter(prefix="/me/favorites", tags=["Favorites"])


@router.get("", response_model=Envelope[Paginated[CapsuleListItem]])
def list_favorites(
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[Paginated[CapsuleListItem]]:
    data = plaza_service.my_favorites(db, user=user, page=page, page_size=pageSize)
    return Envelope(success=True, data=data)


@router.post("", response_model=Envelope[FavoriteResult])
def add_favorite(
    req: FavoriteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[FavoriteResult]:
    data = favorite_service.add_favorite(db, user=user, capsule_id=req.capsuleId)
    return Envelope(success=True, data=data)


@router.delete("/{capsule_id}", status_code=204, response_class=Response)
def remove_favorite(
    capsule_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Response:
    favorite_service.remove_favorite(db, user=user, capsule_id=capsule_id)
    return Response(status_code=204)
