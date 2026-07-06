// capsule-card —— 广场 / 我的 列表卡片。
// 对标 frontends/react-ts CapsuleCard + FavoriteButton（移动布局）。
// 展示：创建者、标题、内容预览、解封状态（倒计时 / 已解封）、收藏。
// 交互经事件上抛父页处理（对齐 RN 的 onPress 回调，逻辑集中在 store）：
//   - bind:opencard  detail = { code }        → 父页 navigateTo 详情
//   - bind:favtoggle detail = { id, favoritedByMe } → 父页调 capsule.toggleFavorite

const { countdownLabel, fmtNumber } = require("../../utils/format");

Component({
  properties: {
    item: { type: Object, value: null },
    // 是否显示收藏按钮（「我创建的」列表隐藏，自己的胶囊不收藏）
    showFavorite: { type: Boolean, value: true },
    // 是否显示删除按钮（「我创建的」列表用）
    showDelete: { type: Boolean, value: false },
  },
  data: {
    countdown: "",
    opened: false,
    favCount: "0",
  },
  observers: {
    item: function (item) {
      if (!item) return;
      this.setData({
        countdown: countdownLabel(item.openAt),
        opened: !!item.isOpened,
        favCount: fmtNumber(item.favoriteCount || 0),
      });
    },
  },
  methods: {
    onOpen() {
      const item = this.data.item;
      if (item) this.triggerEvent("opencard", { code: item.code });
    },
    onFav(e) {
      // 阻止冒泡到卡片（避免同时触发打开）
      const item = this.data.item;
      if (item) {
        this.triggerEvent("favtoggle", {
          id: item.id,
          favoritedByMe: !!item.favoritedByMe,
        });
      }
    },
    onDelete() {
      const item = this.data.item;
      if (item) this.triggerEvent("deletecard", { id: item.id });
    },
  },
});
