/**
 * 契约测试共享工具。
 *
 * 黑盒视角：只通过 HTTP + envelope 约定与目标后端交互，不做任何实现感知。
 * 每个测试文件自带独立随机后缀生成的用户 / 胶囊，互不依赖，也不依赖测试运行顺序。
 */
import { randomBytes } from "node:crypto";

export const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

export type Envelope<T = unknown> = {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode:
    | null
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMITED"
    | "BAD_REQUEST"
    | "INTERNAL_ERROR";
  details?: Array<{ field: string; message: string }>;
};

export type ApiResponse<T = unknown> = {
  status: number;
  headers: Headers;
  body: Envelope<T>;
  raw: string;
};

type Options = {
  token?: string;
  headers?: Record<string, string>;
  json?: unknown;
  expect?: "json" | "empty";
};

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: Options = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body });
  const raw = await res.text();
  let parsed: Envelope<T>;
  if (raw === "") {
    parsed = { success: res.ok, data: null, message: null, errorCode: null };
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `非 JSON 响应 ${method} ${path} -> ${res.status}: ${raw.slice(0, 200)}`,
      );
    }
  }
  return { status: res.status, headers: res.headers, body: parsed, raw };
}

export function rand(n = 6): string {
  return randomBytes(n).toString("hex").slice(0, n);
}

export function uniqueEmail(prefix = "u"): string {
  return `${prefix}-${rand(8)}@hellotime-contract.com`;
}

export function uniqueNickname(prefix = "u"): string {
  return `${prefix}_${rand(6)}`;
}

export function isoFuture(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function isoPast(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

export const AVATARS = [
  "neo",
  "specter",
  "glyph",
  "pulse",
  "circuit",
  "nova",
  "oracle",
  "drift",
  "echo",
  "void",
] as const;

export type RegisteredUser = {
  email: string;
  password: string;
  nickname: string;
  avatarId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export async function register(
  overrides: Partial<{ email: string; password: string; nickname: string; avatarId: string }> = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "password1234";
  const nickname = overrides.nickname ?? uniqueNickname();
  const avatarId = overrides.avatarId ?? "neo";
  const r = await api<{
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  }>("POST", "/api/v1/auth/register", {
    json: { email, password, nickname, avatarId },
  });
  if (r.status !== 201 || !r.body.success || !r.body.data) {
    throw new Error(`register 失败 ${r.status}: ${r.raw}`);
  }
  return {
    email,
    password,
    nickname,
    avatarId,
    accessToken: r.body.data.accessToken,
    refreshToken: r.body.data.refreshToken,
    userId: r.body.data.user.id,
  };
}

export type CreatedCapsule = {
  id: string;
  code: string;
  title: string;
  openAt: string;
};

export async function createCapsule(
  token: string,
  overrides: Partial<{
    title: string;
    content: string;
    openAtSeconds: number;
    inPlaza: boolean;
  }> = {},
): Promise<CreatedCapsule> {
  const payload = {
    title: overrides.title ?? `cap-${rand(4)}`,
    content: overrides.content ?? "hello from contract test",
    openAt: isoFuture(overrides.openAtSeconds ?? 3600),
    inPlaza: overrides.inPlaza ?? true,
  };
  const r = await api<CreatedCapsule>("POST", "/api/v1/capsules", {
    token,
    json: payload,
  });
  if (r.status !== 201 || !r.body.data) {
    throw new Error(`createCapsule 失败 ${r.status}: ${r.raw}`);
  }
  return r.body.data;
}
