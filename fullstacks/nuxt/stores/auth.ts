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
  let session = 0;
  let pending: { session: number; request: Promise<void> } | undefined;

  function getSessionVersion() {
    return session;
  }

  function hydrate() {
    if (hydrated.value) return;
    const persisted = load();
    if (persisted) {
      user.value = persisted.user;
      refreshToken.value = persisted.refreshToken;
    }
    hydrated.value = true;
  }

  function setTokens(t: AuthTokens) {
    session++;
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
    dropFromAuthLost();

    if (callServer && rt) {
      try {
        await api.logout(rt);
      } catch {
        /* 静默：登出失败不阻塞前端清理 */
      }
    }
  }

  function refreshMe() {
    if (pending?.session === session) return pending.request;
    const version = session;
    const request = api.me().then((me) => {
      if (version !== session) return;
      user.value = me;
      persist({ user: me, refreshToken: refreshToken.value });
    }).catch(() => {
      // 客户端处理失效的令牌。
    }).finally(() => {
      if (pending?.request === request) pending = undefined;
    });
    pending = { session: version, request };
    return request;
  }

  function dropFromAuthLost() {
    session++;
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    clearPersist();
  }

  /**
   * 同一账号在另一个标签页轮换了 refresh token：改用 localStorage 里的新令牌。
   * 只接受同一用户的新令牌；登出、换账号由 storage 事件处理（syncFromStorage）。
   */
  function adoptStoredRefreshToken(): boolean {
    const stored = load();
    if (!stored?.refreshToken || !stored.user || !user.value) return false;
    if (stored.user.id !== user.value.id || stored.refreshToken === refreshToken.value) return false;
    refreshToken.value = stored.refreshToken;
    user.value = stored.user;
    return true;
  }

  /** 其他标签页登录、登出或换账号后，本页跟着切换，免得拿过期的令牌去刷新 */
  function syncFromStorage(raw: string | null) {
    let stored: PersistShape | null = null;
    try {
      stored = raw ? (JSON.parse(raw) as PersistShape) : null;
    } catch {
      return;
    }
    if (!stored?.refreshToken || !stored.user) {
      if (refreshToken.value) {
        session++;
        user.value = null;
        accessToken.value = null;
        refreshToken.value = null;
      }
      return;
    }
    if (user.value?.id === stored.user.id) {
      refreshToken.value = stored.refreshToken;
      user.value = stored.user;
      return;
    }
    session++;
    user.value = stored.user;
    accessToken.value = null;
    refreshToken.value = stored.refreshToken;
  }

  return {
    user,
    accessToken,
    refreshToken,
    hydrated,
    getSessionVersion,
    hydrate,
    setTokens,
    patchTokens,
    logout,
    refreshMe,
    dropFromAuthLost,
    adoptStoredRefreshToken,
    syncFromStorage,
  };
});

// 把 store 注入到 api client（一次性配置）。Pinia store 必须在创建 app 之后才能调用，
// 只在浏览器的 Nuxt 启动插件调用，服务端请求之间不共享登录态。
export function wireAuthApi(store: ReturnType<typeof useAuthStore>) {
  configureApi({
    getSessionVersion: store.getSessionVersion,
    getAccessToken: () => store.accessToken,
    getRefreshToken: () => store.refreshToken,
    onTokensRefreshed: (a, r) => store.patchTokens(a, r),
    onAuthLost: () => store.dropFromAuthLost(),
    adoptStoredRefreshToken: store.adoptStoredRefreshToken,
  });
  // storage 事件只在其他标签页改动时触发，本页自己的写入不会回到这里
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) store.syncFromStorage(e.key === null ? null : e.newValue);
  });
}
