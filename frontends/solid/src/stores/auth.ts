// ============================================================
// 鉴权状态：access token 在内存 + refresh token + user 持久化到 localStorage
//
// 用 solid-js/store 的 createStore 持有一份可细粒度订阅的状态对象：
// 组件读 auth.user 只订阅这一个字段，token 轮换不会让头像菜单重新计算。
// 与 api/client 通过 configureApi 解耦（client 不 import store，避免循环依赖）。
// ============================================================

import { createEffect, createRoot, on } from "solid-js";
import { createStore } from "solid-js/store";
import { api, configureApi } from "@/api/client";
import type { AuthTokens, User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
}

const STORAGE_KEY = "hellotime.auth";
let sessionVersion = 0;

interface PersistShape {
  user: User | null;
  refreshToken: string | null;
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistShape) : null;
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

const [auth, setAuth] = createStore<AuthState>({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
});

/** 只读的鉴权状态：auth.user / auth.refreshToken / auth.hydrated */
export { auth };

/** 从 localStorage 恢复登录态。main.tsx 在首次渲染之前调用，守卫第一帧就能拿到正确的 user */
export function hydrateAuth() {
  const p = load();
  setAuth({ user: p?.refreshToken ? p.user : null, refreshToken: p?.refreshToken ?? null, hydrated: true });
}

export function setTokens(t: AuthTokens) {
  sessionVersion++;
  setAuth({ user: t.user, accessToken: t.accessToken, refreshToken: t.refreshToken });
  persist({ user: t.user, refreshToken: t.refreshToken });
}

export function patchTokens(accessToken: string, refreshToken: string) {
  setAuth({ accessToken, refreshToken });
  persist({ user: auth.user, refreshToken });
}

function clearSession() {
  sessionVersion++;
  setAuth({ user: null, accessToken: null, refreshToken: null });
  clearPersist();
}

export async function logout(callServer = true) {
  const rt = auth.refreshToken;
  clearSession();
  if (callServer && rt) {
    try {
      await api.logout(rt);
    } catch {
      /* 静默：登出失败不阻塞前端清理 */
    }
  }
}

/** 令牌轮换仍属于同一次登录。登出或重新登录后，旧请求不能更新当前会话。 */
export const getSessionVersion = () => sessionVersion;

let meInFlight: { version: number; request: Promise<void> } | undefined;

/** 拉一次 /me 刷新用户信息；并发调用共用同一个请求（单飞） */
export function refreshMe(): Promise<void> {
  const version = getSessionVersion();
  if (!auth.refreshToken) return Promise.resolve();
  if (meInFlight?.version === version) return meInFlight.request;
  const request = (async () => {
    try {
      const me = await api.me();
      if (version !== getSessionVersion()) return;
      setAuth({ user: me });
      persist({ user: me, refreshToken: auth.refreshToken });
    } catch {
      // me 拿不到通常是 token 已失效；保持现状由 401 路径接管
    } finally {
      if (meInFlight?.version === version) meInFlight = undefined;
    }
  })();
  meInFlight = { version, request };
  return request;
}

/**
 * 账号变了（登出、登录态失效、换成另一个账号）时调用 fn。
 * 草稿、表单都属于写它的人，靠它清空。effect 放在独立的 root 里，跟随整个应用存活。
 * 注意不能用 on(…, { defer: true })：defer 跳过的那一次不会记下 prev，第一次登出就漏掉了。
 */
export function onAccountChange(fn: () => void) {
  createRoot(() =>
    createEffect(
      on(
        () => auth.user?.id,
        (id, prev) => {
          if (prev && id !== prev) fn();
        },
      ),
    ),
  );
}

// 把 store 注入到 api client（一次性配置）
configureApi({
  getAccessToken: () => auth.accessToken,
  getRefreshToken: () => auth.refreshToken,
  onTokensRefreshed: (a, r) => patchTokens(a, r),
  onAuthLost: clearSession,
});
