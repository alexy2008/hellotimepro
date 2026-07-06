// 登录：移植自 frontends/react-ts/src/pages/LoginPage.tsx。

const { createPage } = require("../../utils/page");
const { api, ApiError } = require("../../utils/api");
const { useAuth } = require("../../stores/auth");

createPage({
  data: { email: "", password: "", busy: false, err: "" },

  onEmail(e) {
    this.setData({ email: e.detail.value });
  },
  onPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async submit() {
    if (this.data.busy) return;
    this.setData({ err: "", busy: true });
    try {
      const tokens = await api.login({
        email: this.data.email.trim(),
        password: this.data.password,
      });
      useAuth.getState().setTokens(tokens);
      this._leave();
    } catch (e) {
      this.setData({ err: e instanceof ApiError ? e.message : "登录失败" });
    } finally {
      this.setData({ busy: false });
    }
  },

  _leave() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/me/index" });
  },

  goRegister() {
    wx.redirectTo({ url: "/pages/register/index" });
  },
  close() {
    this._leave();
  },
});
