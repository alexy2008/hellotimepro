import { ApiError, ERR } from "./errors";

export function ok<T>(set: { status?: unknown }, data: T, status = 200) {
  set.status = status;
  return { success: true, data, message: null, errorCode: null };
}

export function empty(status = 204) {
  return new Response(null, { status });
}

export function errorResponse(e: unknown) {
  const err =
    e instanceof ApiError
      ? e
      : ERR.internal(e instanceof Error ? e.message : "服务器内部错误");
  const body: Record<string, unknown> = {
    success: false,
    data: null,
    message: err.message,
    errorCode: err.code,
  };
  if (err.details?.length) body.details = err.details;
  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function route<T>(
  set: { status?: unknown },
  handler: () => Promise<T> | T,
  status = 200,
) {
  try {
    const data = await handler();
    return ok(set, data, status);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function routeEmpty(handler: () => Promise<unknown> | unknown, status = 204) {
  try {
    await handler();
    return empty(status);
  } catch (e) {
    return errorResponse(e);
  }
}
