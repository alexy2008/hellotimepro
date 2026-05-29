"""GET /capsule-recommendations."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.capsule_recommendation import CapsuleRecommendationList
from app.schemas.common import Envelope
from app.services.capsule_recommendation_service import get_capsule_recommendations

router = APIRouter(tags=["Capsule Suggestion"])


@router.get(
    "/capsule-recommendations",
    response_model=Envelope[CapsuleRecommendationList],
)
def capsule_recommendations(
    count: int = Query(default=4, ge=3, le=8),
    locale: str = Query(default="zh-CN"),
) -> Envelope[CapsuleRecommendationList]:
    return Envelope(success=True, data=get_capsule_recommendations(count=count, locale=locale))
