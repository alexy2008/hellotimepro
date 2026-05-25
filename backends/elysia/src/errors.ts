import { ZodError } from "zod";

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
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ERR = {
  validation(message: string, field?: string) {
    return new ApiError(
      "VALIDATION_ERROR",
      message,
      422,
      field ? [{ field, message }] : undefined,
    );
  },
  validationDetails(message: string, details: ErrorDetail[]) {
    return new ApiError("VALIDATION_ERROR", message, 422, details);
  },
  unauthorized(message = "未登录") {
    return new ApiError("UNAUTHORIZED", message, 401);
  },
  forbidden(message = "无权访问") {
    return new ApiError("FORBIDDEN", message, 403);
  },
  notFound(message = "资源不存在") {
    return new ApiError("NOT_FOUND", message, 404);
  },
  conflict(message: string, field?: string) {
    return new ApiError("CONFLICT", message, 409, field ? [{ field, message }] : undefined);
  },
  rateLimited(message = "请求过于频繁") {
    return new ApiError("RATE_LIMITED", message, 429);
  },
  badRequest(message: string) {
    return new ApiError("BAD_REQUEST", message, 400);
  },
  internal(message = "服务器内部错误") {
    return new ApiError("INTERNAL_ERROR", message, 500);
  },
};

export function zodToApiError(err: ZodError) {
  return ERR.validationDetails(
    "字段校验失败",
    err.issues.map((i) => ({
      field: i.path.length ? i.path.join(".") : "_",
      message: i.message,
    })),
  );
}
