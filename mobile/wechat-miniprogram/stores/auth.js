// ============================================================
// 鉴权状态：access token 在内存 + refresh token + user 持久化到 wx.storage。
// 移植自 mobile/react-native/src/stores/auth.ts。
// 差异：AsyncStorage（异步）→ wx.getStorageSync/setStorageSync（同步），
//       故 hydrate 同步完成，App.onLaunch 里先 hydrate 再进首页，无闪登出。
// 与 utils/api 通过 configureApi 解耦（避免循环依赖）。
// ============================================================

const { create } = require("../utils/store");
const { api, configureApi } = require("../utils/api");

const STORAGE_KEY = "hellotime.auth";

function persist(s) {
  try {
    wx.setStorageSync(STORAGE_KEY, s);
  } catch (e) {
    /* 静默 */
  }
}

const useAuth = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: () => {
    try {
      const persisted = wx.getStorageSync(STORAGE_KEY);
      if (persisted && persisted.refreshToken) {
        set({
          user: persisted.user || null,
          refreshToken: persisted.refreshToken,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      set({ hydrated: true });
    }
  },

  setTokens: (t) => {
    set({
      user: t.user,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
    });
    persist({ user: t.user, refreshToken: t.refreshToken });
  },

  patchTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    persist({ user: get().user, refreshToken });
  },

  logout: async (callServer = true) => {
    const rt = get().refreshToken;
    set({ user: null, accessToken: null, refreshToken: null });
    try {
      wx.removeStorageSync(STORAGE_KEY);
    } catch (e) {
      /* 静默 */
    }
    if (callServer && rt) {
      try {
        await api.logout(rt);
      } catch (e) {
        /* 静默：登出失败不阻塞前端清理 */
      }
    }
  },

  refreshMe: async () => {
    try {
      const me = await api.me();
      set({ user: me });
      persist({ user: me, refreshToken: get().refreshToken });
    } catch (e) {
      // me 拿不到通常是 token 已失效；保持现状由 401 路径接管
    }
  },
}));

// 把 store 注入到 api client（一次性配置）
configureApi({
  getAccessToken: () => useAuth.getState().accessToken,
  getRefreshToken: () => useAuth.getState().refreshToken,
  onTokensRefreshed: (a, r) => useAuth.getState().patchTokens(a, r),
  onAuthLost: () => {
    useAuth.setState({ user: null, accessToken: null, refreshToken: null });
    try {
      wx.removeStorageSync(STORAGE_KEY);
    } catch (e) {
      /* 静默 */
    }
  },
});

module.exports = { useAuth };
