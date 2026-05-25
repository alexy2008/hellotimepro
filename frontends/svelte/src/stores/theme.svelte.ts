// ============================================================
// 主题状态：用 Svelte 5 runes 实现单例
// ============================================================

export type Theme = "dark" | "light";
const KEY = "hellotime.theme";

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

class ThemeStore {
  theme = $state<Theme>("dark");

  hydrate() {
    const t = read();
    apply(t);
    this.theme = t;
  }

  set(t: Theme) {
    apply(t);
    this.theme = t;
  }

  toggle() {
    this.set(this.theme === "dark" ? "light" : "dark");
  }
}

export const themeStore = new ThemeStore();
