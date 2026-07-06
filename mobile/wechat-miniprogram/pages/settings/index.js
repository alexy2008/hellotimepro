// 账号设置（门禁）：移植自 frontends/react-ts/src/pages/MeProfilePage.tsx。
// 基本信息（昵称/头像）+ 修改密码（改后自动登出）。

const { createPage } = require("../../utils/page");
const { api, ApiError } = require("../../utils/api");
const { useAuth } = require("../../stores/auth");

createPage({
  data: {
    user: null,
    avatars: [],
    nickname: "",
    avatarId: null,
    profileBusy: false,
    profileMsg: null, // { cls, text }

    oldPwd: "",
    newPwd: "",
    confirmPwd: "",
    pwdBusy: false,
    pwdMsg: null,
  },

  onLoad() {
    const user = useAuth.getState().user;
    if (!user) {
      wx.redirectTo({ url: "/pages/login/index" });
      return;
    }
    this.setData({
      user,
      nickname: user.nickname,
      avatarId: user.avatarId,
    });
    api.avatars().then((list) => this.setData({ avatars: list })).catch(() => {});
    this._unsubAuth = useAuth.subscribe((s) => {
      if (s.user) this.setData({ user: s.user });
    });
  },

  onUnload() {
    if (this._unsubAuth) this._unsubAuth();
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },
  pickAvatar(e) {
    this.setData({ avatarId: e.currentTarget.dataset.id });
  },

  resetProfile() {
    const u = this.data.user;
    if (u) this.setData({ nickname: u.nickname, avatarId: u.avatarId, profileMsg: null });
  },

  async saveProfile() {
    if (this.data.profileBusy) return;
    this.setData({ profileMsg: null, profileBusy: true });
    try {
      const u = this.data.user;
      const patch = {};
      if (u && this.data.nickname !== u.nickname) patch.nickname = this.data.nickname.trim();
      if (u && this.data.avatarId && this.data.avatarId !== u.avatarId)
        patch.avatarId = this.data.avatarId;
      if (Object.keys(patch).length === 0) {
        this.setData({ profileMsg: { cls: "hint", text: "没有改动" } });
        return;
      }
      await api.updateProfile(patch);
      await useAuth.getState().refreshMe();
      this.setData({ profileMsg: { cls: "msg-success", text: "已保存" } });
    } catch (e) {
      this.setData({
        profileMsg: {
          cls: "error-box",
          text: e instanceof ApiError ? e.message : "保存失败",
        },
      });
    } finally {
      this.setData({ profileBusy: false });
    }
  },

  onOldPwd(e) {
    this.setData({ oldPwd: e.detail.value });
  },
  onNewPwd(e) {
    this.setData({ newPwd: e.detail.value });
  },
  onConfirmPwd(e) {
    this.setData({ confirmPwd: e.detail.value });
  },

  async changePassword() {
    if (this.data.pwdBusy) return;
    this.setData({ pwdMsg: null });
    if (this.data.newPwd !== this.data.confirmPwd) {
      this.setData({ pwdMsg: { cls: "error-box", text: "两次输入的新密码不一致" } });
      return;
    }
    this.setData({ pwdBusy: true });
    try {
      await api.changePassword({
        currentPassword: this.data.oldPwd,
        newPassword: this.data.newPwd,
      });
      this.setData({
        pwdMsg: { cls: "msg-success", text: "密码已更新，3 秒后将自动登出。" },
        oldPwd: "",
        newPwd: "",
        confirmPwd: "",
      });
      setTimeout(() => {
        void useAuth
          .getState()
          .logout(false)
          .then(() => wx.redirectTo({ url: "/pages/login/index" }));
      }, 3000);
    } catch (e) {
      this.setData({
        pwdMsg: {
          cls: "error-box",
          text: e instanceof ApiError ? e.message : "修改失败",
        },
      });
    } finally {
      this.setData({ pwdBusy: false });
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/me/index" });
  },
});
