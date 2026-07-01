// ============================================================
// Electron preload：在隔离上下文里向渲染层暴露最小、安全的桥面。
// contextIsolation=true 下，渲染层只能看到这里 expose 的内容，
// 看不到 Node / ipcRenderer 原始对象 —— 这是 Electron 的安全边界。
//
// 当前内嵌的是未改动的 React SPA，不会调用 window.helloDesktop；
// 保留它作为 IPC / contextBridge 的教学样本，也是「desktop-aware 前端」
// 接入原生桥（例如显示一个『导出』按钮）的挂载点。
// ============================================================
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("helloDesktop", {
  shell: "electron",
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // 与原生菜单共用主进程同一处理器
  appInfo: () => ipcRenderer.invoke("hello:app-info"),
  exportAppInfo: () => ipcRenderer.invoke("hello:export-app-info"),
});
