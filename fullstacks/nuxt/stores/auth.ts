// ============================================================
// 鉴权状态：access token 在内存 + refresh token + user 持久化到 localStorage
// 与 api/client 通过 configureApi 解耦（避免循环依赖）
// ============================================================

import { defineStore } from "pinia";
import { ref } from "vue";
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

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const hydrated = ref(false);

  function hydrate() {
    const persisted = load();
    if (persisted) {
      user.value = persisted.user;
      refreshToken.value = persisted.refreshToken;
    }
    hydrated.value = true;
  }

  function setTokens(t: AuthTokens) {
    user.value = t.user;
    accessToken.value = t.accessToken;
    refreshToken.value = t.refreshToken;
    persist({ user: t.user, refreshToken: t.refreshToken });
  }

  function patchTokens(at: string, rt: string) {
    accessToken.value = at;
    refreshToken.value = rt;
    persist({ user: user.value, refreshToken: rt });
  }

  async function logout(callServer = true) {
    const rt = refreshToken.value;
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    clearPersist();

    if (callServer && rt) {
      try {
        await api.logout(rt);
      } catch {
        /* 静默：登出失败不阻塞前端清理 */
      }
    }
  }

  async function refreshMe() {
    try {
      const me = await api.me();
      user.value = me;
      persist({ user: me, refreshToken: refreshToken.value });
    } catch {
      // me 拿不到通常是 token 已失效；保持现状由 401 路径接管
    }
  }

  function dropFromAuthLost() {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    clearPersist();
  }

  return {
    user,
    accessToken,
    refreshToken,
    hydrated,
    hydrate,
    setTokens,
    patchTokens,
    logout,
    refreshMe,
    dropFromAuthLost,
  };
});

// 把 store 注入到 api client（一次性配置）。Pinia store 必须在创建 app 之后才能调用，
// 这一步在 main.ts 用 wireAuthApi() 显式触发，避免模块加载顺序问题。
export function wireAuthApi() {
  const store = useAuthStore();
  configureApi({
    getAccessToken: () => store.accessToken,
    getRefreshToken: () => store.refreshToken,
    onTokensRefreshed: (a, r) => store.patchTokens(a, r),
    onAuthLost: () => store.dropFromAuthLost(),
  });
}
