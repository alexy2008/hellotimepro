// 凭码胶囊详情：移植自 CapsuleByCodePage + CapsuleDetail（匿名可访问）。
// 实时倒计时 + 到期自动开启轮询 + 复制码 / 分享 / 收藏。

const { createPage } = require("../../utils/page");
const { api, ApiError } = require("../../utils/api");
const { useAuth } = require("../../stores/auth");
const { countdownTo, fmtDateTime } = require("../../utils/format");

function pad2(n) {
  return String(n).padStart(2, "0");
}

createPage({
  data: {
    code: "",
    cap: null,
    err: "",
    loading: true,
    opened: false,
    openAtText: "",
    // 倒计时四格
    units: [
      { v: "00", l: "天" },
      { v: "00", l: "时" },
      { v: "00", l: "分" },
      { v: "00", l: "秒" },
    ],
    expired: false,
    codeCopied: false,
    hasUser: false,
  },

  onLoad(query) {
    const code = String((query && query.code) || "").toUpperCase();
    this.setData({ code, hasUser: !!useAuth.getState().user });
    void this.loadCapsule(true);
  },

  onUnload() {
    this._clearTimers();
  },

  _clearTimers() {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
    if (this._poll) {
      clearTimeout(this._poll);
      this._poll = null;
    }
  },

  async loadCapsule(showLoading) {
    if (showLoading) this.setData({ loading: true });
    this.setData({ err: "" });
    try {
      const c = await api.capsuleByCode(this.data.code);
      this._applyCapsule(c);
      return c;
    } catch (e) {
      this.setData({ err: e instanceof ApiError ? e.message : "胶囊不存在" });
      return null;
    } finally {
      if (showLoading) this.setData({ loading: false });
    }
  },

  _applyCapsule(c) {
    const opened = !!c.isOpened;
    this.setData({
      cap: c,
      opened,
      openAtText: fmtDateTime(c.openAt),
    });
    this._clearTimers();
    this._renderCountdown();
    if (!opened) {
      // 每秒刷新倒计时
      this._tick = setInterval(() => this._renderCountdown(), 1000);
      // 到期后开始轮询自动开启
      const openAtMs = new Date(c.openAt).getTime();
      const delay = Math.max(0, openAtMs - Date.now() + 250);
      this._poll = setTimeout(() => this._pollOpen(), delay);
    }
  },

  async _pollOpen() {
    const refreshed = await this.loadCapsule(false);
    if (refreshed && !refreshed.isOpened) {
      this._poll = setTimeout(() => this._pollOpen(), 1000);
    }
  },

  _renderCountdown() {
    const cap = this.data.cap;
    if (!cap) return;
    const cd = countdownTo(cap.openAt);
    this.setData({
      expired: cd.expired,
      units: [
        { v: pad2(cd.days), l: "天" },
        { v: pad2(cd.hours), l: "时" },
        { v: pad2(cd.minutes), l: "分" },
        { v: pad2(cd.seconds), l: "秒" },
      ],
    });
  },

  copyCode() {
    const cap = this.data.cap;
    if (!cap) return;
    wx.setClipboardData({
      data: cap.code,
      success: () => {
        this.setData({ codeCopied: true });
        setTimeout(() => this.setData({ codeCopied: false }), 2000);
      },
    });
  },

  // 分享：小程序转发用 onShareAppMessage（右上角菜单 / share 按钮触发）
  onShareAppMessage() {
    const cap = this.data.cap;
    const title = cap
      ? `时光胶囊「${cap.title}」· 胶囊码 ${cap.code}`
      : "HelloTime Pro 时光胶囊";
    return {
      title,
      path: cap ? `/pages/capsule/index?code=${cap.code}` : "/pages/plaza/index",
    };
  },

  async onFav() {
    if (!useAuth.getState().user) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    const cap = this.data.cap;
    if (!cap) return;
    try {
      if (cap.favoritedByMe) {
        await api.unfavorite(cap.id);
        this.setData({
          cap: Object.assign({}, cap, {
            favoritedByMe: false,
            favoriteCount: Math.max(0, cap.favoriteCount - 1),
          }),
        });
      } else {
        const r = await api.favorite(cap.id);
        this.setData({
          cap: Object.assign({}, cap, {
            favoritedByMe: true,
            favoriteCount: r.favoriteCount,
          }),
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || "操作失败", icon: "none" });
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/plaza/index" });
  },
  goOpen() {
    wx.switchTab({ url: "/pages/open/index" });
  },
});
