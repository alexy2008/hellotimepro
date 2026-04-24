"""POST /auth/register · /auth/login · /auth/refresh · /auth/logout"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas.common import Envelope
from app.schemas.user import (
    AuthTokens,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=Envelope[AuthTokens], status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> Envelope[AuthTokens]:
    tokens = auth_service.register(
        db,
        email=req.email,
        password=req.password,
        nickname=req.nickname,
        avatar_id=req.avatarId,
    )
    return Envelope(success=True, data=tokens)


@router.post("/login", response_model=Envelope[AuthTokens])
def login(req: LoginRequest, db: Session = Depends(get_db)) -> Envelope[AuthTokens]:
    tokens = auth_service.login(db, email=req.email, password=req.password)
    return Envelope(success=True, data=tokens)


@router.post("/refresh", response_model=Envelope[AuthTokens])
def refresh(req: RefreshRequest, db: Session = Depends(get_db)) -> Envelope[AuthTokens]:
    tokens = auth_service.refresh(db, raw_refresh=req.refreshToken)
    return Envelope(success=True, data=tokens)


@router.post("/logout", status_code=204, response_class=Response)
def logout(
    req: LogoutRequest | None = None, db: Session = Depends(get_db)
) -> Response:
    auth_service.logout(db, raw_refresh=(req.refreshToken if req else None))
    return Response(status_code=204)
