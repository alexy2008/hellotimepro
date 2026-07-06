// ============================================================
// 主题状态：dark / light，持久化到 wx.storage。
// 移植自 mobile/react-native/src/stores/theme.ts。
// 差异：AsyncStorage（异步）→ wx.getStorageSync/setStorageSync（同步），
//       故 hydrate 改回同步（更接近 Web 版 localStorage）；页面根节点按 mode
//       挂 class="app-root theme-{{mode}}"，即切换 WXSS 变量表（见 tokens.wxss）。
// ============================================================

const { create } = require("../utils/store");
const { tokens } = require("../tokens/palette");

const KEY = "hellotime.theme";

const useTheme = create((set, get) => ({
  mode: "dark",

  hydrate: () => {
    try {
      const v = wx.getStorageSync(KEY);
      set({ mode: v === "light" ? "light" : "dark" });
    } catch (e) {
      /* 忽略：保持默认 dark */
    }
  },

  toggle: () => {
    const next = get().mode === "dark" ? "light" : "dark";
    set({ mode: next });
    try {
      wx.setStorageSync(KEY, next);
    } catch (e) {
      /* 静默 */
    }
  },

  setMode: (t) => {
    set({ mode: t });
    try {
      wx.setStorageSync(KEY, t);
    } catch (e) {
      /* 静默 */
    }
  },
}));

/** 当前主题调色板（JS 侧取色用：tabBar 选中色、辉光等）。 */
function palette() {
  return tokens.semantic[useTheme.getState().mode];
}

module.exports = { useTheme, palette };
