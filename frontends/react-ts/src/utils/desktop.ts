// ============================================================
// 桌面壳检测：本 React 前端既作独立 SPA 运行，也被 desktop/electron 内嵌。
//
// 主信号是构建期环境变量 VITE_DESKTOP_SHELL —— 由 desktop/electron/run 在
// 拉起内嵌前端 Vite 时注入（=electron）。独立运行（hello start react）不注入，
// 因此独立 SPA 完全不显示桌面端内容。
// 备用信号是 Electron preload 注入的 window.helloDesktop（真实窗口内才有）。
//
// 桌面端图标作为客户端资源放在本前端 public/desktop-icons/，不依赖后端 /static。
// ============================================================

export interface DesktopStackItem {
  role: string;
  name: string;
  iconUrl: string;
}

interface HelloDesktopBridge {
  shell?: string;
}

/** 返回当前所在的桌面壳标识；非桌面环境返回 null。 */
export function desktopShell(): "electron" | null {
  const envShell = import.meta.env.VITE_DESKTOP_SHELL;
  if (envShell === "electron") return "electron";
  if (typeof window !== "undefined") {
    const bridge = (window as { helloDesktop?: HelloDesktopBridge }).helloDesktop;
    if (bridge?.shell === "electron") return "electron";
  }
  return null;
}

/** Electron 桌面壳技术栈：自带 Chromium + Node.js 壳。 */
export const ELECTRON_STACK: DesktopStackItem[] = [
  { role: "desktop-shell", name: "Electron", iconUrl: "/desktop-icons/electron.svg" },
  { role: "desktop-runtime", name: "Node.js", iconUrl: "/desktop-icons/nodejs.svg" },
];

/** 当前桌面壳对应的技术栈条目；非桌面环境返回空数组。 */
export function desktopStack(): DesktopStackItem[] {
  return desktopShell() === "electron" ? ELECTRON_STACK : [];
}
