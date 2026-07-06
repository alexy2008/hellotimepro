// 注册：移植自 frontends/react-ts/src/pages/RegisterPage.tsx。
// 邮箱/昵称/密码 + 头像选择（必选）→ 注册成功进入创建。

const { createPage } = require("../../utils/page");
const { api, ApiError } = require("../../utils/api");
const { useAuth } = require("../../stores/auth");

createPage({
  data: {
    avatars: [],
    email: "",
    nickname: "",
    password: "",
    avatarId: null,
    busy: false,
    err: "",
  },

  onLoad() {
    api
      .avatars()
      .then((list) => {
        this.setData({
          avatars: list,
          avatarId: list.length > 0 ? list[0].id : null,
        });
      })
      .catch(() =>
        this.setData({ err: "拉取头像列表失败，请检查后端是否已启动" }),
      );
  },

  onEmail(e) {
    this.setData({ email: e.detail.value });
  },
  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },
  onPassword(e) {
    this.setData({ password: e.detail.value });
  },
  pickAvatar(e) {
    this.setData({ avatarId: e.currentTarget.dataset.id });
  },

  async submit() {
    if (this.data.busy) return;
    if (!this.data.avatarId) {
      this.setData({ err: "请选择一个头像" });
      return;
    }
    this.setData({ err: "", busy: true });
    try {
      const tokens = await api.register({
        email: this.data.email.trim(),
        password: this.data.password,
        nickname: this.data.nickname.trim(),
        avatarId: this.data.avatarId,
      });
      useAuth.getState().setTokens(tokens);
      wx.switchTab({ url: "/pages/create/index" });
    } catch (e) {
      this.setData({ err: e instanceof ApiError ? e.message : "注册失败" });
    } finally {
      this.setData({ busy: false });
    }
  },

  goLogin() {
    wx.redirectTo({ url: "/pages/login/index" });
  },
  close() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/plaza/index" });
  },
});
