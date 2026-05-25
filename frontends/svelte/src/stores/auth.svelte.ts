// ============================================================
// 鉴权状态：access token 在内存 + refresh token + user 持久化到 localStorage
// 与 api/client 通过 configureApi 解耦（避免循环依赖）
//
// 教学版方案：refresh token 持久化到 localStorage，对应 docs/02-design.md §7.2
// "更简单方案"。XSS 风险在生产环境需要切换到 httpOnly cookie。
// ============================================================

import { api, configureApi } from "@/api/client";
import type { AuthTokens, User } from "@/types";

const STORAGE_KEY = "hellotime.auth";

interface PersistShape {
  user: User | null;
  refreshToken: string | null;
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch {
    return null;
  }
}

function persist(s: PersistShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function clearPersist() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

class AuthStore {
  user = $state<User | null>(null);
  accessToken = $state<string | null>(null);
  refreshToken = $state<string | null>(null);
  hydrated = $state(false);

  hydrate() {
    const persisted = load();
    if (persisted) {
      this.user = persisted.user;
      this.refreshToken = persisted.refreshToken;
    }
    this.hydrated = true;
  }

  setTokens(t: AuthTokens) {
    this.user = t.user;
    this.accessToken = t.accessToken;
    this.refreshToken = t.refreshToken;
    persist({ user: t.user, refreshToken: t.refreshToken });
  }

  patchTokens(at: string, rt: string) {
    this.accessToken = at;
    this.refreshToken = rt;
    persist({ user: this.user, refreshToken: rt });
  }

  async logout(callServer = true) {
    const rt = this.refreshToken;
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    clearPersist();

    if (callServer && rt) {
      try {
        await api.logout(rt);
      } catch {
        /* 静默：登出失败不阻塞前端清理 */
      }
    }
  }

  async refreshMe() {
    try {
      const me = await api.me();
      this.user = me;
      persist({ user: me, refreshToken: this.refreshToken });
    } catch {
      // me 拿不到通常是 token 已失效；保持现状由 401 路径接管
    }
  }

  dropFromAuthLost() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    clearPersist();
  }
}

export const authStore = new AuthStore();

// 把 store 注入到 api client（一次性配置）。在 main.ts 调用一次即可。
export function wireAuthApi() {
  configureApi({
    getAccessToken: () => authStore.accessToken,
    getRefreshToken: () => authStore.refreshToken,
    onTokensRefreshed: (a, r) => authStore.patchTokens(a, r),
    onAuthLost: () => authStore.dropFromAuthLost(),
  });
}
