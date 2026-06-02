/**
 * 浏览器侧 API 客户端 · 与 React 实现保持同构。
 * - 自动刷新 access token
 * - 包装统一的 Envelope 解构
 */
"use client";

import {
  ApiError,
  type AuthTokens,
  type Avatar,
  type CapsuleDetail,
  type CapsuleSuggestion,
  type CapsuleSuggestionRequest,
  type CapsuleRecommendationList,
  type ChangePasswordRequest,
  type CreateCapsuleRequest,
  type Envelope,
  type FavoriteResult,
  type HealthData,
  type LoginRequest,
  type PaginatedCapsules,
  type PlazaQuery,
  type RegisterRequest,
  type UpdateProfileRequest,
  type UserOut,
} from "@/types";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  _retry?: boolean;
}

let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let onTokensRefreshed: (a: string, r: string) => void = () => {};
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
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const env = (await res.json()) as Envelope<{ accessToken: string; refreshToken: string }>;
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

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const useAuth = opts.auth ?? true;
  let accessToken: string | null = null;
  if (useAuth) {
    accessToken = getAccessToken() ?? (await tryRefresh());
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError("响应解析失败", res.status, "INTERNAL_ERROR");
  }

  if (!res.ok || !env.success) {
    if (
      res.status === 401 &&
      env.errorCode === "UNAUTHORIZED" &&
      useAuth &&
      !opts._retry &&
      getRefreshToken()
    ) {
      const newAt = await tryRefresh();
      if (newAt) return request<T>(path, { ...opts, _retry: true });
    }
    throw new ApiError(env.message ?? "请求失败", res.status, env.errorCode, env.details);
  }
  return env.data as T;
}

export const api = {
  health: () => request<HealthData>("/api/v1/health", { auth: false }),
  avatars: () => request<Avatar[]>("/api/v1/avatars", { auth: false }),
  register: (body: RegisterRequest) =>
    request<AuthTokens>("/api/v1/auth/register", { method: "POST", body, auth: false }),
  login: (body: LoginRequest) =>
    request<AuthTokens>("/api/v1/auth/login", { method: "POST", body, auth: false }),
  logout: (refreshToken: string | null) =>
    request<void>("/api/v1/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      auth: false,
    }),
  me: () => request<UserOut>("/api/v1/me"),
  updateProfile: (body: UpdateProfileRequest) =>
    request<UserOut>("/api/v1/me", { method: "PATCH", body }),
  changePassword: (body: ChangePasswordRequest) =>
    request<void>("/api/v1/me/password", { method: "POST", body }),
  createCapsule: (body: CreateCapsuleRequest) =>
    request<CapsuleDetail>("/api/v1/capsules", { method: "POST", body }),
  capsuleByCode: (code: string) =>
    request<CapsuleDetail>(`/api/v1/capsules/${encodeURIComponent(code)}`),
  plaza: (q: PlazaQuery = {}) => {
    const params = new URLSearchParams();
    if (q.sort) params.set("sort", q.sort);
    if (q.filter) params.set("filter", q.filter);
    if (q.q) params.set("q", q.q);
    if (q.page) params.set("page", String(q.page));
    if (q.pageSize) params.set("pageSize", String(q.pageSize));
    const qs = params.toString();
    return request<PaginatedCapsules>(`/api/v1/plaza/capsules${qs ? `?${qs}` : ""}`);
  },
  myCapsules: (page = 1, pageSize = 20) =>
    request<PaginatedCapsules>(`/api/v1/me/capsules?page=${page}&pageSize=${pageSize}`),
  deleteMyCapsule: (id: string) =>
    request<void>(`/api/v1/me/capsules/${encodeURIComponent(id)}`, { method: "DELETE" }),
  myFavorites: (page = 1, pageSize = 20) =>
    request<PaginatedCapsules>(`/api/v1/me/favorites?page=${page}&pageSize=${pageSize}`),
  favorite: (capsuleId: string) =>
    request<FavoriteResult>("/api/v1/me/favorites", {
      method: "POST",
      body: { capsuleId },
    }),
  unfavorite: (capsuleId: string) =>
    request<void>(`/api/v1/me/favorites/${encodeURIComponent(capsuleId)}`, {
      method: "DELETE",
    }),
  suggestCapsule: (body: CapsuleSuggestionRequest) =>
    request<CapsuleSuggestion>("/api/v1/capsule-suggestion", { method: "POST", body }),
  capsuleRecommendations: (params: { count?: number; locale?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.count) qs.set("count", String(params.count));
    if (params.locale) qs.set("locale", params.locale);
    const q = qs.toString();
    return request<CapsuleRecommendationList>(
      `/api/v1/capsule-recommendations${q ? `?${q}` : ""}`,
      { auth: false },
    );
  },
};
