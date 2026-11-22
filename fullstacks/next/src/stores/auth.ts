// ============================================================
// 鉴权状态：access token 在内存 + refresh token + user 持久化到 localStorage
// 与 api/client 通过 configureApi 解耦（避免循环依赖）
// ============================================================

import { create } from "zustand";
import { api } from "@/api/client";
import { configureApi } from "@/api/client";
import type { User, AuthTokens } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setTokens: (t: AuthTokens) => void;
  patchTokens: (accessToken: string, refreshToken: string) => void;
  logout: (callServer?: boolean) => Promise<void>;
  refreshMe: () => Promise<void>;
}

let sessionVersion = 0;
export const getSessionVersion = () => sessionVersion;
let meRequest: { version: number; promise: Promise<void> } | undefined;

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

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: () => {
    const persisted = load();
    if (persisted) {
      set({
        user: persisted.refreshToken ? persisted.user : null,
        refreshToken: persisted.refreshToken,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  setTokens: (t) => {
    sessionVersion++;
    set({
      user: t.user,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
    });
    persist({ user: t.user, refreshToken: t.refreshToken });
  },

  patchTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    const u = get().user;
    persist({ user: u, refreshToken });
  },

  logout: async (callServer = true) => {
    sessionVersion++;
    const rt = get().refreshToken;
    set({ user: null, accessToken: null, refreshToken: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }

    if (callServer && rt) {
      try {
        await api.logout(rt);
      } catch {
        /* 静默：登出失败不阻塞前端清理 */
      }
    }
  },

  refreshMe: () => {
    const version = sessionVersion;
    if (!get().refreshToken) return Promise.resolve();
    if (meRequest?.version === version) return meRequest.promise;
    const promise = api.me().then((me) => {
      if (version !== sessionVersion) return;
      set({ user: me });
      persist({ user: me, refreshToken: get().refreshToken });
    }).catch(() => undefined).finally(() => {
      if (meRequest?.version === version) meRequest = undefined;
    });
    meRequest = { version, promise };
    return promise;
  },
}));

// 把 store 注入到 api client（一次性配置）
configureApi({
  getSessionVersion,
  getAccessToken: () => useAuth.getState().accessToken,
  getRefreshToken: () => useAuth.getState().refreshToken,
  onTokensRefreshed: (a, r) => useAuth.getState().patchTokens(a, r),
  onAuthLost: () => {
    sessionVersion++;
    useAuth.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  },
});
