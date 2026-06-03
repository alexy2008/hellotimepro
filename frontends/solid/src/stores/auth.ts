// ============================================================
// 鉴权状态：access token 在内存，refresh token + user 持久化到 localStorage
//
// 用 solid-js/store 的 createStore 持有一份可细粒度订阅的状态对象，
// 组件读取 auth.user 时只订阅该字段。与 api/client 通过 configureApi
// 解耦（避免循环依赖：client 不 import store）。
// ============================================================

import { createStore } from "solid-js/store";
import { api, configureApi } from "@/api/client";
import type { User, AuthTokens } from "@/types";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
}

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

const [auth, setAuth] = createStore<AuthStore>({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
});

export { auth };

export function hydrateAuth() {
  const persisted = load();
  if (persisted) {
    setAuth({
      user: persisted.user,
      refreshToken: persisted.refreshToken,
      hydrated: true,
    });
  } else {
    setAuth({ hydrated: true });
  }
}

export function setTokens(t: AuthTokens) {
  setAuth({
    user: t.user,
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
  });
  persist({ user: t.user, refreshToken: t.refreshToken });
}

export function patchTokens(accessToken: string, refreshToken: string) {
  setAuth({ accessToken, refreshToken });
  persist({ user: auth.user, refreshToken });
}

export async function logout(callServer = true) {
  const rt = auth.refreshToken;
  setAuth({ user: null, accessToken: null, refreshToken: null });
  clearPersist();

  if (callServer && rt) {
    try {
      await api.logout(rt);
    } catch {
      /* 静默：登出失败不阻塞前端清理 */
    }
  }
}

export async function refreshMe() {
  try {
    const me = await api.me();
    setAuth({ user: me });
    persist({ user: me, refreshToken: auth.refreshToken });
  } catch {
    // me 拿不到通常是 token 已失效；保持现状由 401 路径接管
  }
}

// 把 store 注入到 api client（一次性配置）
configureApi({
  getAccessToken: () => auth.accessToken,
  getRefreshToken: () => auth.refreshToken,
  onTokensRefreshed: (a, r) => patchTokens(a, r),
  onAuthLost: () => {
    setAuth({ user: null, accessToken: null, refreshToken: null });
    clearPersist();
  },
});
