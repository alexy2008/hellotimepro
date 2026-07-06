// 创建：移植自 frontends/react-ts/src/pages/CreatePage.tsx（门禁）。
// AI 推荐/生成 + 标题/正文 + 开启时间选择器 + 快捷预设 + 广场公开开关 + 上锁封存。

const { createPage } = require("../../utils/page");
const { api, ApiError } = require("../../utils/api");
const { useAuth } = require("../../stores/auth");
const { isoToLocalInput, localInputToIso } = require("../../utils/format");

function presetTime(spec) {
  const now = new Date();
  switch (spec) {
    case "1m":
      now.setSeconds(now.getSeconds() + 130);
      break;
    case "1h":
      now.setHours(now.getHours() + 1);
      break;
    case "tomorrow9":
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    case "1y":
      now.setFullYear(now.getFullYear() + 1);
      break;
    case "y2030":
      return "2030-01-01T00:00";
  }
  return isoToLocalInput(now.toISOString());
}

const QUICK = [
  { key: "1m", label: "1 分钟后（测试）" },
  { key: "1h", label: "1 小时后" },
  { key: "tomorrow9", label: "明天 9:00" },
  { key: "1y", label: "1 年后" },
  { key: "y2030", label: "2030.01.01" },
];

// "YYYY-MM-DDTHH:mm" ↔ { date, time }
function splitLocal(local) {
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

let recoSeq = 0;

createPage({
  data: {
    hasUser: false,
    quick: QUICK,

    title: "",
    content: "",
    contentLen: 0,
    openDate: "",
    openTime: "",
    inPlaza: true,

    busy: false,
    err: "",
    aiBusy: false,
    aiInfo: "",
    aiGenerated: false,

    recos: [],
    recoBusy: false,
  },

  onLoad() {
    const init = splitLocal(presetTime("1h"));
    this.setData({
      hasUser: !!useAuth.getState().user,
      openDate: init.date,
      openTime: init.time,
    });
    this._unsubAuth = useAuth.subscribe((s) =>
      this.setData({ hasUser: !!s.user }),
    );
  },

  onShow() {
    if (useAuth.getState().user && this.data.recos.length === 0) {
      void this.loadRecos();
    }
  },

  onUnload() {
    if (this._unsubAuth) this._unsubAuth();
  },

  // ---- 输入 ----
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },
  onContentInput(e) {
    const v = e.detail.value;
    this.setData({ content: v, contentLen: v.length });
  },
  onDateChange(e) {
    this.setData({ openDate: e.detail.value });
  },
  onTimeChange(e) {
    this.setData({ openTime: e.detail.value });
  },
  applyPreset(e) {
    const p = splitLocal(presetTime(e.currentTarget.dataset.k));
    this.setData({ openDate: p.date, openTime: p.time });
  },
  togglePlaza(e) {
    this.setData({ inPlaza: e.detail.value });
  },

  // ---- AI ----
  async runAi() {
    const t = this.data.title.trim();
    const autoTitle = !t;
    this.setData({ err: "", aiInfo: "", aiBusy: true });
    try {
      const s = await api.suggestCapsule({ title: t || undefined });
      const p = splitLocal(isoToLocalInput(s.openAt));
      const patch = {
        content: s.content,
        contentLen: s.content.length,
        openDate: p.date,
        openTime: p.time,
        aiGenerated: true,
      };
      if (s.title && autoTitle && !this.data.title.trim()) patch.title = s.title;
      const source =
        s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      const titleNote =
        s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
      patch.aiInfo = `${titleNote}，建议 ${s.openInDays} 天后开启 · 来源：${source}`;
      this.setData(patch);
    } catch (e) {
      this.setData({
        err: e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试",
      });
    } finally {
      this.setData({ aiBusy: false });
    }
  },

  async loadRecos() {
    const seq = ++recoSeq;
    this.setData({ recoBusy: true });
    try {
      const list = await api.capsuleRecommendations({ count: 4 });
      if (seq !== recoSeq) return;
      if (list.items.length > 0) this.setData({ recos: list.items });
    } catch (e) {
      /* 推荐失败静默 */
    } finally {
      if (seq === recoSeq) this.setData({ recoBusy: false });
    }
  },

  pickReco(e) {
    const reco = this.data.recos[e.currentTarget.dataset.i];
    if (!reco) return;
    this.setData({ title: reco.title, content: "", contentLen: 0, aiGenerated: false });
    void this.runAi();
  },

  // ---- 提交 ----
  async submit() {
    if (this.data.busy) return;
    this.setData({ err: "", busy: true });
    try {
      const created = await api.createCapsule({
        title: this.data.title.trim(),
        content: this.data.content,
        openAt: localInputToIso(`${this.data.openDate}T${this.data.openTime}`),
        inPlaza: this.data.inPlaza,
      });
      wx.navigateTo({ url: `/pages/capsule/index?code=${created.code}` });
    } catch (e) {
      this.setData({ err: e instanceof ApiError ? e.message : "创建失败" });
    } finally {
      this.setData({ busy: false });
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },
  goRegister() {
    wx.navigateTo({ url: "/pages/register/index" });
  },
});
