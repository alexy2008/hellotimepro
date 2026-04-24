"""统一响应壳 + 分页。对应 spec/api/openapi.yaml 的 Envelope / Pagination。"""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    """统一响应壳。"""

    success: bool = True
    data: T | None = None
    message: str | None = None
    errorCode: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorEnvelope(BaseModel):
    success: bool = False
    data: Any | None = None
    message: str
    errorCode: str
    details: list[ErrorDetail] | None = None


class Pagination(BaseModel):
    page: int = Field(ge=1)
    pageSize: int = Field(ge=1, le=50)
    total: int = Field(ge=0)
    totalPages: int = Field(ge=0)


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    pagination: Pagination
