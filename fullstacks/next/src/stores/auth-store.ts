"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, configureApi } from "@/lib/api-client";
import type { UserOut } from "@/types";

interface AuthState {
  user: UserOut | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setSession: (user: UserOut, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserOut) => void;
  clear: () => void;
  /** 启动时同步用户信息 */
  hydrate: () => Promise<void>;
  /** 主动重新拉取 /me（登录后或保存资料后），失败时静默 */
  refreshMe: () => Promise<void>;
  /**
   * 登出：清空本地态，并可选地通知服务端撤销 refresh token。
   * @param callServer 默认 true；保存密码后调用 api 端点会失败（旧 refresh token 已被吊销），传 false 跳过。
   */
  logout: (callServer?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null, // 仅内存
      refreshToken: null,
      isHydrated: false,

      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),

      hydrate: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ isHydrated: true });
          return;
        }
        try {
          const u = await api.me();
          set({ user: u, isHydrated: true });
        } catch {
          set({ user: null, accessToken: null, isHydrated: true });
        }
      },

      refreshMe: async () => {
        try {
          const u = await api.me();
          set({ user: u });
        } catch {
          /* 静默：token 失效路径由 401 处理器接管 */
        }
      },

      logout: async (callServer = true) => {
        const rt = get().refreshToken;
        set({ user: null, accessToken: null, refreshToken: null });
        if (callServer && rt) {
          try {
            await api.logout(rt);
          } catch {
            /* 静默：登出失败不阻塞前端清理 */
          }
        }
      },
    }),
    {
      name: "hellotime-pro-auth",
      storage: createJSONStorage(() => localStorage),
      // access token 不持久化（短期 + 内存安全）
      partialize: (s) => ({ user: s.user, refreshToken: s.refreshToken }),
    },
  ),
);

if (typeof window !== "undefined") {
  configureApi({
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onTokensRefreshed: (a, r) => useAuthStore.getState().setTokens(a, r),
    onAuthLost: () => useAuthStore.getState().clear(),
  });
}
