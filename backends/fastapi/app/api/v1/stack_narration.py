"""POST /stack-narration."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.common import Envelope
from app.schemas.stack_narration import StackNarration, StackNarrationRequest
from app.services.stack_narration_service import narrate_stack

router = APIRouter(tags=["Stack Narration"])


@router.post("/stack-narration", response_model=Envelope[StackNarration])
def stack_narration(body: StackNarrationRequest) -> Envelope[StackNarration]:
    return Envelope(success=True, data=narrate_stack(body))
