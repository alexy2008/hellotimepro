/**
 * 业务错误：与 spec/api/openapi.yaml 的 errorCode 一一对应。
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: ErrorDetail[];
  constructor(code: ErrorCode, message: string, status: number, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export const ERR = {
  validation(message: string, field?: string): ApiError {
    return new ApiError(
      "VALIDATION_ERROR",
      message,
      422,
      field ? [{ field, message }] : undefined,
    );
  },
  validationDetails(message: string, details: ErrorDetail[]): ApiError {
    return new ApiError("VALIDATION_ERROR", message, 422, details);
  },
  unauthorized(message = "未登录"): ApiError {
    return new ApiError("UNAUTHORIZED", message, 401);
  },
  forbidden(message = "无权访问"): ApiError {
    return new ApiError("FORBIDDEN", message, 403);
  },
  notFound(message = "资源不存在"): ApiError {
    return new ApiError("NOT_FOUND", message, 404);
  },
  conflict(message: string, field?: string): ApiError {
    return new ApiError(
      "CONFLICT",
      message,
      409,
      field ? [{ field, message }] : undefined,
    );
  },
  rateLimited(message = "请求过于频繁"): ApiError {
    return new ApiError("RATE_LIMITED", message, 429);
  },
  badRequest(message: string): ApiError {
    return new ApiError("BAD_REQUEST", message, 400);
  },
  internal(message = "服务器内部错误"): ApiError {
    return new ApiError("INTERNAL_ERROR", message, 500);
  },
};
