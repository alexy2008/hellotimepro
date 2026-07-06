// 关于：移植自 frontends/react-ts/src/pages/AboutPage.tsx。
// 产品简介 + 小程序端技术栈 + 后端技术栈（from /health）+ 后端连通点。
// 图标为 SVG，小程序 <image> 不认，故技术栈以「名称 + 版本」文本列表呈现。

const { createPage } = require("../../utils/page");
const { api } = require("../../utils/api");
const { API_BASE } = require("../../config");

const MOBILE_STACK = [
  { name: "微信小程序", version: "原生框架" },
  { name: "WXML / WXSS", version: "" },
  { name: "JavaScript", version: "ES6" },
];

const MOBILE_SUMMARY =
  "基于微信小程序原生框架（App/Page/Component + WXML/WXSS + wx.request + setData）：" +
  "无第三方框架，用一个 40 行的可观察 store（getState/setState/subscribe）承接从 Web React 前端" +
  "移植来的业务逻辑（JWT 刷新单飞 / 收藏计数 / 胶囊开启判定）与类型契约。" +
  "与 frontends/react-ts 对照——同一套 store/api 逻辑，一个渲染成 DOM、一个渲染成小程序原生组件；" +
  "视图层按小程序 IA（底部 tabBar + 页面栈）重建。设计令牌经 codegen 从 tokens.json 落地为 " +
  "tokens.wxss（CSS 变量，随主题切类）+ palette.js。wx.request 直连后端 :9080（开发者工具需关闭合法域名校验）。";

createPage({
  data: {
    apiBase: API_BASE,
    mobileStack: MOBILE_STACK,
    mobileSummary: MOBILE_SUMMARY,
    health: null,
    backendItems: [],
    backendFramework: "—",
    connected: null, // null=连接中 true=在线 false=离线
  },

  onLoad() {
    api
      .health()
      .then((d) => {
        const order = ["framework", "language", "database"];
        const items = [...d.stack.items].sort(
          (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
        );
        const fw = d.stack.items.find((it) => it.role === "framework");
        this.setData({
          health: d,
          backendItems: items,
          backendFramework: fw ? fw.name : "—",
          connected: true,
        });
      })
      .catch(() => this.setData({ connected: false }));
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/plaza/index" });
  },
});
