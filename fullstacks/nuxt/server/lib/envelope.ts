/**
 * 统一响应包装：{ success, data, message, errorCode, details? }
 *
 * 与 spec/api/openapi.yaml 的 Envelope schema 对齐。
 */
import type { H3Event } from "h3";
import { setResponseStatus } from "h3";
import { ApiError, isApiError } from "./errors";
import type { ErrorCode } from "./errors";

export interface OkEnvelope<T> {
  success: true;
  data: T;
  message: null;
  errorCode: null;
}

export interface ErrEnvelope {
  success: false;
  data: null;
  message: string;
  errorCode: ErrorCode;
  details?: Array<{ field: string; message: string }>;
}

export function ok<T>(event: H3Event, data: T, status = 200): OkEnvelope<T> {
  setResponseStatus(event, status);
  return { success: true, data, message: null, errorCode: null } as OkEnvelope<T>;
}

export function err(event: H3Event, error: ApiError): ErrEnvelope {
  const body: ErrEnvelope = {
    success: false,
    data: null,
    message: error.message,
    errorCode: error.code,
  };
  if (error.details && error.details.length) body.details = error.details;
  setResponseStatus(event, error.status);
  return body;
}

/**
 * 包装 route handler，将抛出的 ApiError 自动转为 errorEnvelope。
 * 其它异常 → INTERNAL_ERROR。
 */
export function withApi<T>(
  event: H3Event,
  handler: () => Promise<T> | T,
  opts: { successStatus?: number; emptyBody?: boolean } = {},
): Promise<OkEnvelope<T> | ErrEnvelope | null> {
  const status = opts.successStatus ?? 200;
  return Promise.resolve()
    .then(handler)
    .then((data) => {
      setResponseStatus(event, status);
      if (opts.emptyBody) {
        return null;
      }
      return ok(event, data, status);
    })
    .catch((e: unknown) => {
      if (isApiError(e)) return err(event, e);
      console.error("[withApi] unexpected error:", e);
      return err(
        event,
        new ApiError("INTERNAL_ERROR", e instanceof Error ? e.message : "服务器内部错误", 500),
      );
    });
}
