/**
 * 统一响应包装：{ success, data, message, errorCode, details? }
 *
 * 与 spec/api/openapi.yaml 的 Envelope schema 对齐。
 */
import "server-only";
import { NextResponse } from "next/server";
import { ApiError, ErrorCode, isApiError } from "./errors";

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

export function ok<T>(data: T, status = 200): NextResponse<OkEnvelope<T>> {
  return NextResponse.json(
    { success: true, data, message: null, errorCode: null } as OkEnvelope<T>,
    { status },
  );
}

export function err(error: ApiError): NextResponse<ErrEnvelope> {
  const body: ErrEnvelope = {
    success: false,
    data: null,
    message: error.message,
    errorCode: error.code,
  };
  if (error.details && error.details.length) body.details = error.details;
  return NextResponse.json(body, { status: error.status });
}

/**
 * 包装 route handler，将抛出的 ApiError 自动转为 errorEnvelope。
 * 其它异常 → INTERNAL_ERROR。
 */
export function withApi<T>(
  handler: () => Promise<T> | T,
  opts: { successStatus?: number; emptyBody?: boolean } = {},
): Promise<NextResponse> {
  const status = opts.successStatus ?? 200;
  return Promise.resolve()
    .then(handler)
    .then((data) => {
      if (opts.emptyBody) {
        return new NextResponse(null, { status });
      }
      return ok(data, status);
    })
    .catch((e: unknown) => {
      if (isApiError(e)) return err(e);
      console.error("[withApi] unexpected error:", e);
      return err(new ApiError("INTERNAL_ERROR", e instanceof Error ? e.message : "服务器内部错误", 500));
    });
}
