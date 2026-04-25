// ============================================================
// API 客户端：统一拼接 URL、解响应包装、自动 refresh
//
// - access token 存内存（auth store）；refresh token 同样存 store + localStorage
//   （教学版采用 localStorage，对应方案见 docs/02-design.md §7.2 的"更简单方案"）
// - access token 缺失 / 过期时，会触发一次 refresh + 重放
// ============================================================

import { ApiError, type Envelope } from "@/types";

const BASE = ""; // 走 vite 代理；生产同源

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  // 用于内部重试控制，外部不传
  _retry?: boolean;
}

// 这两个回调由 auth store 注册，避免循环依赖
let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let onTokensRefreshed: (accessToken: string, refreshToken: string) => void =
  () => {};
let onAuthLost: () => void = () => {};

export function configureApi(opts: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (a: string, r: string) => void;
  onAuthLost: () => void;
}) {
  getAccessToken = opts.getAccessToken;
  getRefreshToken = opts.getRefreshToken;
  onTokensRefreshed = opts.onTokensRefreshed;
  onAuthLost = opts.onAuthLost;
}

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const env = (await res.json()) as Envelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      if (!res.ok || !env.success || !env.data) {
        onAuthLost();
        return null;
      }
      onTokensRefreshed(env.data.accessToken, env.data.refreshToken);
      return env.data.accessToken;
    } catch {
      onAuthLost();
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function accessTokenForRequest(useAuth: boolean): Promise<string | null> {
  if (!useAuth) return null;
  const accessToken = getAccessToken();
  if (accessToken) return accessToken;
  return tryRefresh();
}

function shouldTryRefresh<T>(
  res: Response,
  env: Envelope<T>,
  useAuth: boolean,
  retry: boolean | undefined,
): boolean {
  return (
    res.status === 401 &&
    env.errorCode === "UNAUTHORIZED" &&
    useAuth &&
    !retry &&
    !!getRefreshToken()
  );
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const useAuth = opts.auth ?? true;
  const accessToken = await accessTokenForRequest(useAuth);
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError("响应解析失败", res.status, "INTERNAL_ERROR");
  }

  if (!res.ok || !env.success) {
    // 401 → 自动 refresh + 重放。覆盖 access token 过期、缺失、无效等恢复场景。
    if (shouldTryRefresh(res, env, useAuth, opts._retry)) {
      const newAt = await tryRefresh();
      if (newAt) {
        return request<T>(path, { ...opts, _retry: true });
      }
    }
    throw new ApiError(
      env.message ?? "请求失败",
      res.status,
      env.errorCode,
      env.details,
    );
  }

  return env.data as T;
}

// ---------- 端点封装 ----------

import type {
  AuthTokens,
  Avatar,
  CapsuleDetail,
  CreateCapsuleRequest,
  HealthData,
  LoginRequest,
  PaginatedCapsules,
  PlazaQuery,
  RegisterRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  User,
} from "@/types";

export const api = {
  health: () => request<HealthData>("/api/v1/health", { auth: false }),

  avatars: () => request<Avatar[]>("/api/v1/avatars", { auth: false }),

  // ---- 鉴权
  register: (body: RegisterRequest) =>
    request<AuthTokens>("/api/v1/auth/register", {
      method: "POST",
      body,
      auth: false,
    }),
  login: (body: LoginRequest) =>
    request<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body,
      auth: false,
    }),
  logout: (refreshToken: string | null) =>
    request<void>("/api/v1/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      auth: false,
    }),

  // ---- 当前用户
  me: () => request<User>("/api/v1/me"),
  updateProfile: (body: UpdateProfileRequest) =>
    request<User>("/api/v1/me", { method: "PATCH", body }),
  changePassword: (body: ChangePasswordRequest) =>
    request<void>("/api/v1/me/password", { method: "POST", body }),

  // ---- 胶囊
  createCapsule: (body: CreateCapsuleRequest) =>
    request<CapsuleDetail>("/api/v1/capsules", { method: "POST", body }),
  capsuleByCode: (code: string) =>
    request<CapsuleDetail>(`/api/v1/capsules/${encodeURIComponent(code)}`, {
      auth: true,
    }),
  capsuleById: (id: string) =>
    request<CapsuleDetail>(`/api/v1/plaza/capsules/${encodeURIComponent(id)}`, {
      auth: true,
    }),

  // ---- 广场
  plaza: (q: PlazaQuery = {}) => {
    const params = new URLSearchParams();
    if (q.sort) params.set("sort", q.sort);
    if (q.filter) params.set("filter", q.filter);
    if (q.q) params.set("q", q.q);
    if (q.page) params.set("page", String(q.page));
    if (q.pageSize) params.set("pageSize", String(q.pageSize));
    const qs = params.toString();
    return request<PaginatedCapsules>(
      `/api/v1/plaza/capsules${qs ? `?${qs}` : ""}`,
      { auth: true },
    );
  },

  // ---- 我创建的
  myCapsules: (page = 1, pageSize = 20) =>
    request<PaginatedCapsules>(
      `/api/v1/me/capsules?page=${page}&pageSize=${pageSize}`,
    ),
  deleteMyCapsule: (id: string) =>
    request<void>(`/api/v1/me/capsules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // ---- 收藏
  myFavorites: (page = 1, pageSize = 20) =>
    request<PaginatedCapsules>(
      `/api/v1/me/favorites?page=${page}&pageSize=${pageSize}`,
    ),
  favorite: (capsuleId: string) =>
    request<{ capsuleId: string; favoriteCount: number; favoritedAt: string }>(
      "/api/v1/me/favorites",
      { method: "POST", body: { capsuleId } },
    ),
  unfavorite: (capsuleId: string) =>
    request<void>(
      `/api/v1/me/favorites/${encodeURIComponent(capsuleId)}`,
      { method: "DELETE" },
    ),
};
