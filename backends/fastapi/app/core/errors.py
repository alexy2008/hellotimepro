"""统一错误码 + 响应包装。

所有业务异常通过 `APIError` 抛出，`main.py` 注册的 exception handler
把它们序列化为 ErrorEnvelope，避免业务层感知 HTTP 细节。
"""

from __future__ import annotations

from enum import StrEnum


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    BAD_REQUEST = "BAD_REQUEST"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# spec: errorCode → HTTP status
ERROR_TO_STATUS: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.CONFLICT: 409,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.BAD_REQUEST: 400,
    ErrorCode.INTERNAL_ERROR: 500,
}


class APIError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        details: list[dict[str, str]] | None = None,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        self.status_code = status_code or ERROR_TO_STATUS[code]


def validation_error(message: str, *, field: str, rule: str | None = None) -> APIError:
    detail = {"field": field, "message": rule or message}
    return APIError(ErrorCode.VALIDATION_ERROR, message, details=[detail])


def unauthorized(message: str = "未登录或凭证无效") -> APIError:
    return APIError(ErrorCode.UNAUTHORIZED, message)


def forbidden(message: str = "无权访问") -> APIError:
    return APIError(ErrorCode.FORBIDDEN, message)


def not_found(message: str = "资源不存在") -> APIError:
    return APIError(ErrorCode.NOT_FOUND, message)


def conflict(message: str, *, field: str | None = None) -> APIError:
    details = [{"field": field, "message": message}] if field else None
    return APIError(ErrorCode.CONFLICT, message, details=details)


def bad_request(message: str) -> APIError:
    return APIError(ErrorCode.BAD_REQUEST, message)


def rate_limited(message: str = "操作过于频繁，请稍后再试") -> APIError:
    return APIError(ErrorCode.RATE_LIMITED, message)
