"""POST /capsule-suggestion."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.capsule_suggestion import CapsuleSuggestion, CapsuleSuggestionRequest
from app.schemas.common import Envelope
from app.services.capsule_suggestion_service import suggest_capsule

router = APIRouter(tags=["Capsule Suggestion"])


@router.post("/capsule-suggestion", response_model=Envelope[CapsuleSuggestion])
def capsule_suggestion(body: CapsuleSuggestionRequest) -> Envelope[CapsuleSuggestion]:
    return Envelope(success=True, data=suggest_capsule(body))
