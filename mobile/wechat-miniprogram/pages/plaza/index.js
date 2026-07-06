// 广场：移植自 frontends/react-ts/src/pages/PlazaPage.tsx（移动布局）。
// 紧凑 hero + 工具条（排序/筛选/搜索）+ 胶囊流 + 分页。

const { createPage } = require("../../utils/page");
const { usePlaza } = require("../../stores/plaza");
const { useCapsule } = require("../../stores/capsule");
const { useAuth } = require("../../stores/auth");
const { fmtNumber } = require("../../utils/format");

createPage({
  data: {
    items: [],
    loading: false,
    pagination: null,
    page: 1,
    sort: "new",
    filter: "all",
    q: "",
    hasUser: false,
    totalLabel: "",
  },

  onLoad() {
    this._unsubPlaza = usePlaza.subscribe((s) => {
      this.setData({
        items: s.items,
        loading: s.loading,
        pagination: s.pagination,
        page: s.page,
        sort: s.sort,
        filter: s.filter,
        totalLabel: s.pagination ? `共 ${fmtNumber(s.pagination.total)} 条` : "",
      });
    });
    this._unsubAuth = useAuth.subscribe((s) =>
      this.setData({ hasUser: !!s.user }),
    );
    this.setData({ hasUser: !!useAuth.getState().user });
  },

  onShow() {
    // 每次进入广场刷新一遍（反映详情页收藏变化等）
    void usePlaza.getState().fetch();
  },

  onUnload() {
    if (this._unsubPlaza) this._unsubPlaza();
    if (this._unsubAuth) this._unsubAuth();
  },

  // ---- 工具条 ----
  onSort(e) {
    usePlaza.getState().setSort(e.currentTarget.dataset.v);
  },
  onFilter(e) {
    usePlaza.getState().setFilter(e.currentTarget.dataset.v);
  },
  onSearchInput(e) {
    this.setData({ q: e.detail.value });
  },
  onSearchConfirm() {
    usePlaza.getState().setQ(this.data.q);
  },

  // ---- 分页 ----
  prevPage() {
    const p = usePlaza.getState().page;
    if (p > 1) usePlaza.getState().setPage(p - 1);
  },
  nextPage() {
    const { page, pagination } = usePlaza.getState();
    if (pagination && page < pagination.totalPages)
      usePlaza.getState().setPage(page + 1);
  },

  // ---- 卡片交互 ----
  onOpenCard(e) {
    wx.navigateTo({
      url: `/pages/capsule/index?code=${e.detail.code}`,
    });
  },
  async onFavToggle(e) {
    if (!useAuth.getState().user) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    const { id, favoritedByMe } = e.detail;
    try {
      await useCapsule.getState().toggleFavorite(id, favoritedByMe);
    } catch (err) {
      wx.showToast({ title: err.message || "操作失败", icon: "none" });
    }
  },

  // ---- CTA ----
  goCreate() {
    if (useAuth.getState().user) {
      wx.switchTab({ url: "/pages/create/index" });
    } else {
      wx.navigateTo({ url: "/pages/register/index" });
    }
  },
  goOpen() {
    wx.switchTab({ url: "/pages/open/index" });
  },
  goAbout() {
    wx.navigateTo({ url: "/pages/about/index" });
  },
});
