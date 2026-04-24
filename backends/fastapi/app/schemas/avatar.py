from __future__ import annotations

from pydantic import BaseModel


class Avatar(BaseModel):
    id: str
    name: str
    primaryColor: str
    svgUrl: str
