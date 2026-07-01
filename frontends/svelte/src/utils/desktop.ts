// ============================================================
// 桌面壳检测：本 Svelte 前端既作独立 SPA 运行，也被 desktop/tauri 内嵌。
//
// 主信号是构建期环境变量 VITE_DESKTOP_SHELL —— 由 desktop/tauri 在拉起内嵌前端
// Vite 时注入（=tauri）。独立运行（hello start svelte）不注入，因此独立 SPA
// 完全不显示桌面端内容。
// 备用信号是 Tauri 运行时注入的 window.__TAURI_INTERNALS__（真实窗口内才有）。
//
// 桌面端图标作为客户端资源放在本前端 public/desktop-icons/，不依赖后端 /static。
// ============================================================

export interface DesktopStackItem {
  role: string;
  name: string;
  iconUrl: string;
}

/** 返回当前所在的桌面壳标识；非桌面环境返回 null。 */
export function desktopShell(): "tauri" | null {
  if (import.meta.env.VITE_DESKTOP_SHELL === "tauri") return "tauri";
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    return "tauri";
  }
  return null;
}

/** Tauri 桌面壳技术栈：系统 WebView + Rust 壳。 */
export const TAURI_STACK: DesktopStackItem[] = [
  { role: "desktop-shell", name: "Tauri", iconUrl: "/desktop-icons/tauri.svg" },
  { role: "desktop-language", name: "Rust", iconUrl: "/desktop-icons/rust.svg" },
];

/** 当前桌面壳对应的技术栈条目；非桌面环境返回空数组。 */
export function desktopStack(): DesktopStackItem[] {
  return desktopShell() === "tauri" ? TAURI_STACK : [];
}
