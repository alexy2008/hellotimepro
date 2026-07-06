// ============================================================
// App 全局入口：启动即同步 hydrate 主题 + 鉴权（wx.storage 同步，无闪登出）。
// 对齐 Web 版 main.tsx / RN 版根布局的启动序：先补水本地态，再进首页。
// ============================================================

const { useTheme } = require("./stores/theme");
const { useAuth } = require("./stores/auth");

App({
  onLaunch() {
    // 同步补水（wx.storage 同步 API）：主题 + 鉴权 refresh token / user
    useTheme.getState().hydrate();
    useAuth.getState().hydrate();
    // 有 refresh token 则后台校准一次用户信息（失败静默，由 401 路径接管）
    if (useAuth.getState().refreshToken) {
      void useAuth.getState().refreshMe();
    }
  },
});
