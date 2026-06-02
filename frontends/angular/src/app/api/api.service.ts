// ============================================================
// API 客户端：统一拼接 URL、解响应包装、自动 refresh
//
// 使用原生 fetch（与 React/Vue 实现保持同构），通过
// configure() 接收 auth store 的回调来解耦循环依赖。
// ============================================================

import { Injectable } from '@angular/core';
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
  type HealthData,
  type LoginRequest,
  type PaginatedCapsules,
  type PlazaQuery,
  type RegisterRequest,
  type UpdateProfileRequest,
  type User,
} from '@/types';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  _retry?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private getAccessToken: () => string | null = () => null;
  private getRefreshToken: () => string | null = () => null;
  private onTokensRefreshed: (a: string, r: string) => void = () => {};
  private onAuthLost: () => void = () => {};
  private refreshing: Promise<string | null> | null = null;

  configure(opts: {
    getAccessToken: () => string | null;
    getRefreshToken: () => string | null;
    onTokensRefreshed: (a: string, r: string) => void;
    onAuthLost: () => void;
  }) {
    this.getAccessToken = opts.getAccessToken;
    this.getRefreshToken = opts.getRefreshToken;
    this.onTokensRefreshed = opts.onTokensRefreshed;
    this.onAuthLost = opts.onAuthLost;
  }

  private async tryRefresh(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    this.refreshing = (async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const env = (await res.json()) as Envelope<{
          accessToken: string;
          refreshToken: string;
        }>;
        if (!res.ok || !env.success || !env.data) {
          this.onAuthLost();
          return null;
        }
        this.onTokensRefreshed(env.data.accessToken, env.data.refreshToken);
        return env.data.accessToken;
      } catch {
        this.onAuthLost();
        return null;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  private async accessTokenForRequest(useAuth: boolean): Promise<string | null> {
    if (!useAuth) return null;
    const at = this.getAccessToken();
    if (at) return at;
    return this.tryRefresh();
  }

  private shouldTryRefresh<T>(
    res: Response,
    env: Envelope<T>,
    useAuth: boolean,
    retry: boolean | undefined,
  ): boolean {
    return (
      res.status === 401 &&
      env.errorCode === 'UNAUTHORIZED' &&
      useAuth &&
      !retry &&
      !!this.getRefreshToken()
    );
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((opts.headers as Record<string, string>) ?? {}),
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    const useAuth = opts.auth ?? true;
    const accessToken = await this.accessTokenForRequest(useAuth);
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

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
      throw new ApiError('响应解析失败', res.status, 'INTERNAL_ERROR');
    }

    if (!res.ok || !env.success) {
      if (this.shouldTryRefresh(res, env, useAuth, opts._retry)) {
        const newAt = await this.tryRefresh();
        if (newAt) return this.request<T>(path, { ...opts, _retry: true });
      }
      throw new ApiError(
        env.message ?? '请求失败',
        res.status,
        env.errorCode,
        env.details,
      );
    }

    return env.data as T;
  }

  // ---------- 端点封装 ----------

  health = () => this.request<HealthData>('/api/v1/health', { auth: false });

  suggestCapsule = (body: CapsuleSuggestionRequest) =>
    this.request<CapsuleSuggestion>('/api/v1/capsule-suggestion', {
      method: 'POST', body,
    });

  capsuleRecommendations = (params: { count?: number; locale?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.count) qs.set('count', String(params.count));
    if (params.locale) qs.set('locale', params.locale);
    const q = qs.toString();
    return this.request<CapsuleRecommendationList>(
      `/api/v1/capsule-recommendations${q ? `?${q}` : ''}`,
      { auth: false },
    );
  };

  avatars = () => this.request<Avatar[]>('/api/v1/avatars', { auth: false });

  register = (body: RegisterRequest) =>
    this.request<AuthTokens>('/api/v1/auth/register', { method: 'POST', body, auth: false });

  login = (body: LoginRequest) =>
    this.request<AuthTokens>('/api/v1/auth/login', { method: 'POST', body, auth: false });

  logout = (refreshToken: string | null) =>
    this.request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      auth: false,
    });

  me = () => this.request<User>('/api/v1/me');

  updateProfile = (body: UpdateProfileRequest) =>
    this.request<User>('/api/v1/me', { method: 'PATCH', body });

  changePassword = (body: ChangePasswordRequest) =>
    this.request<void>('/api/v1/me/password', { method: 'POST', body });

  createCapsule = (body: CreateCapsuleRequest) =>
    this.request<CapsuleDetail>('/api/v1/capsules', { method: 'POST', body });

  capsuleByCode = (code: string) =>
    this.request<CapsuleDetail>(`/api/v1/capsules/${encodeURIComponent(code)}`, { auth: true });

  plaza = (q: PlazaQuery = {}) => {
    const params = new URLSearchParams();
    if (q.sort) params.set('sort', q.sort);
    if (q.filter) params.set('filter', q.filter);
    if (q.q) params.set('q', q.q);
    if (q.page) params.set('page', String(q.page));
    if (q.pageSize) params.set('pageSize', String(q.pageSize));
    const qs = params.toString();
    return this.request<PaginatedCapsules>(
      `/api/v1/plaza/capsules${qs ? `?${qs}` : ''}`,
      { auth: true },
    );
  };

  myCapsules = (page = 1, pageSize = 20) =>
    this.request<PaginatedCapsules>(`/api/v1/me/capsules?page=${page}&pageSize=${pageSize}`);

  deleteMyCapsule = (id: string) =>
    this.request<void>(`/api/v1/me/capsules/${encodeURIComponent(id)}`, { method: 'DELETE' });

  myFavorites = (page = 1, pageSize = 20) =>
    this.request<PaginatedCapsules>(`/api/v1/me/favorites?page=${page}&pageSize=${pageSize}`);

  favorite = (capsuleId: string) =>
    this.request<{ capsuleId: string; favoriteCount: number; favoritedAt: string }>(
      '/api/v1/me/favorites',
      { method: 'POST', body: { capsuleId } },
    );

  unfavorite = (capsuleId: string) =>
    this.request<void>(`/api/v1/me/favorites/${encodeURIComponent(capsuleId)}`, {
      method: 'DELETE',
    });
}
