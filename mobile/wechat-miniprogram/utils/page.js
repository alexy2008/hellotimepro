// ============================================================
// createPage(options) —— 页面工厂：给每个页面自动接上主题。
//
// 原生小程序无法直接给 <page> 挂 class，故每页根节点写
//   <view class="app-root theme-{{themeMode}}">，themeMode 由本工厂注入并订阅
// theme store（切换即换 tokens.wxss 变量表，对齐 Web 的 <html data-theme>）。
// 用户自定义的 onLoad/onShow/onUnload 会被透传调用，互不干扰。
// ============================================================

const { useTheme } = require("../stores/theme");

function createPage(options) {
  const { onLoad, onUnload } = options;

  return Page(
    Object.assign({ toggleTheme() { useTheme.getState().toggle(); } }, options, {
      onLoad(query) {
        this.setData({ themeMode: useTheme.getState().mode });
        this.__themeUnsub = useTheme.subscribe((s) =>
          this.setData({ themeMode: s.mode }),
        );
        if (onLoad) onLoad.call(this, query);
      },
      onUnload() {
        if (this.__themeUnsub) this.__themeUnsub();
        if (onUnload) onUnload.call(this);
      },
    }),
  );
}

module.exports = { createPage };
