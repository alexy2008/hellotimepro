// 开启：移植自 frontends/react-ts/src/pages/OpenPage.tsx（移动布局）。
// 8 位大写码输入 → 校验存在后跳详情页；粘贴用 wx.getClipboardData。

const { createPage } = require("../../utils/page");
const { api } = require("../../utils/api");
const { ApiError } = require("../../utils/api");

function sanitize(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

createPage({
  data: {
    code: "",
    err: "",
    busy: false,
  },

  onInput(e) {
    this.setData({ code: sanitize(e.detail.value), err: "" });
  },

  async open() {
    const c = this.data.code;
    if (c.length !== 8 || this.data.busy) return;
    this.setData({ err: "", busy: true });
    try {
      const cap = await api.capsuleByCode(c);
      wx.navigateTo({ url: `/pages/capsule/index?code=${cap.code}` });
    } catch (e) {
      this.setData({
        err: e instanceof ApiError ? e.message : "找不到这条胶囊",
      });
    } finally {
      this.setData({ busy: false });
    }
  },

  paste() {
    wx.getClipboardData({
      success: (res) => {
        const filtered = sanitize(res.data);
        this.setData({ code: filtered });
        if (filtered.length === 8) this.open();
      },
      fail: () => this.setData({ err: "粘贴失败" }),
    });
  },
});
