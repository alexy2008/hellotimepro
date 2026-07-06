// 我的：合并 frontends/react-ts 的 MeCreated / MeFavorites + 资料汇总（移动 hub）。
// 资料卡（头像/昵称/邮箱 + 设置/登出）+ 我创建的/我收藏的 分段 + 列表 + 分页。门禁。

const { createPage } = require("../../utils/page");
const { useAuth } = require("../../stores/auth");
const { useCapsule } = require("../../stores/capsule");
const { palette } = require("../../stores/theme");

createPage({
  data: {
    hasUser: false,
    user: null,
    tab: "created",
    mine: { items: [], loading: false, pagination: null, page: 1 },
    favorites: { items: [], loading: false, pagination: null, page: 1 },
  },

  onLoad() {
    this._unsubAuth = useAuth.subscribe((s) =>
      this.setData({ hasUser: !!s.user, user: s.user }),
    );
    this._unsubCap = useCapsule.subscribe((s) =>
      this.setData({ mine: s.mine, favorites: s.favorites }),
    );
    const a = useAuth.getState();
    this.setData({ hasUser: !!a.user, user: a.user });
    const c = useCapsule.getState();
    this.setData({ mine: c.mine, favorites: c.favorites });
  },

  onShow() {
    if (useAuth.getState().user) this._fetchCurrent(1);
  },

  onUnload() {
    if (this._unsubAuth) this._unsubAuth();
    if (this._unsubCap) this._unsubCap();
  },

  _fetchCurrent(page) {
    if (this.data.tab === "created") void useCapsule.getState().fetchMine(page);
    else void useCapsule.getState().fetchFavorites(page);
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.t;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    this._fetchCurrent(1);
  },

  // ---- 分页 ----
  prevPage() {
    const slice = this.data.tab === "created" ? this.data.mine : this.data.favorites;
    if (slice.page > 1) this._fetchCurrent(slice.page - 1);
  },
  nextPage() {
    const slice = this.data.tab === "created" ? this.data.mine : this.data.favorites;
    if (slice.pagination && slice.page < slice.pagination.totalPages)
      this._fetchCurrent(slice.page + 1);
  },

  // ---- 卡片交互 ----
  onOpenCard(e) {
    wx.navigateTo({ url: `/pages/capsule/index?code=${e.detail.code}` });
  },
  onDeleteCard(e) {
    const id = e.detail.id;
    wx.showModal({
      title: "撤回胶囊",
      content: "确认撤回？此操作不可恢复。",
      confirmText: "撤回",
      // showModal 属性吃不了 CSS 变量，从 palette 取 danger.solid
      confirmColor: palette().danger.solid,
      success: (res) => {
        if (res.confirm) {
          useCapsule
            .getState()
            .deleteCapsule(id)
            .catch((err) =>
              wx.showToast({ title: err.message || "撤回失败", icon: "none" }),
            );
        }
      },
    });
  },
  async onFavToggle(e) {
    const { id, favoritedByMe } = e.detail;
    try {
      await useCapsule.getState().toggleFavorite(id, favoritedByMe);
    } catch (err) {
      wx.showToast({ title: err.message || "操作失败", icon: "none" });
    }
  },

  // ---- 账号 ----
  goSettings() {
    wx.navigateTo({ url: "/pages/settings/index" });
  },
  doLogout() {
    wx.showModal({
      title: "登出",
      content: "确认登出当前账号？",
      confirmText: "登出",
      confirmColor: palette().danger.solid,
      success: (res) => {
        if (res.confirm) {
          void useAuth
            .getState()
            .logout()
            .then(() => {
              useCapsule.getState().reset();
              wx.switchTab({ url: "/pages/plaza/index" });
            });
        }
      },
    });
  },
  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },
  goCreate() {
    wx.switchTab({ url: "/pages/create/index" });
  },
  goPlaza() {
    wx.switchTab({ url: "/pages/plaza/index" });
  },
});
