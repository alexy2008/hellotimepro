// ============================================================
// 主题状态：dark / light，持久化到 localStorage
//
// SolidJS 习惯：全局状态用模块级 signal 直接导出 getter，
// 配套导出动作函数。signal 脱离组件树存在，任意组件读取 theme()
// 即建立细粒度订阅，只有真正用到它的节点才会更新。
// ============================================================

import { createSignal } from "solid-js";

export type Theme = "dark" | "light";
const KEY = "hellotime.theme";

const [theme, setThemeSignal] = createSignal<Theme>("dark");
export { theme };

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* noop */
  }
  return "dark";
}

function apply(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* noop */
  }
}

export function hydrateTheme() {
  const t = read();
  apply(t);
  setThemeSignal(t);
}

export function toggleTheme() {
  const next = theme() === "dark" ? "light" : "dark";
  apply(next);
  setThemeSignal(next);
}

export function setTheme(t: Theme) {
  apply(t);
  setThemeSignal(t);
}
