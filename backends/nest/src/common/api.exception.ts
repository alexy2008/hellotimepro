import { HttpException } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

const ERROR_TO_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiException extends HttpException {
  readonly errorCode: ErrorCode;
  readonly details: ErrorDetail[] | null;

  constructor(
    code: ErrorCode,
    message: string,
    details: ErrorDetail[] | null = null,
    statusOverride?: number,
  ) {
    super(message, statusOverride ?? ERROR_TO_STATUS[code]);
    this.errorCode = code;
    this.details = details;
  }
}

export function validationError(message: string, field: string, rule?: string): ApiException {
  return new ApiException('VALIDATION_ERROR', message, [{ field, message: rule ?? message }]);
}

export function unauthorized(message = '未登录或凭证无效'): ApiException {
  return new ApiException('UNAUTHORIZED', message);
}

export function forbidden(message = '无权访问'): ApiException {
  return new ApiException('FORBIDDEN', message);
}

export function notFound(message = '资源不存在'): ApiException {
  return new ApiException('NOT_FOUND', message);
}

export function conflict(message: string, field?: string): ApiException {
  const details = field ? [{ field, message }] : null;
  return new ApiException('CONFLICT', message, details);
}

export function badRequest(message: string): ApiException {
  return new ApiException('BAD_REQUEST', message);
}

export function rateLimited(message = '操作过于频繁，请稍后再试'): ApiException {
  return new ApiException('RATE_LIMITED', message);
}
