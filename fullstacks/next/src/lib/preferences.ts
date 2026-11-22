// ============================================================
// 界面偏好（皮肤 × 明暗）的存放约定：服务端与浏览器共用这一份。
//
// - localStorage（hellotime.skin / hellotime.theme）：首帧权威，与 React 参考前端同名
// - Cookie（ht-skin / ht-theme）：给服务端看的副本，根布局据此输出 <html data-skin data-theme>
//   并渲染对应皮肤的 DOM；浏览器每次切换都同步写，水合后也会按本地值校正一次
//
// 两者不一致时（旧标签页、只预设了 localStorage 的浏览器、清过 Cookie……），
// 首帧脚本以 localStorage 为准改写 <html>，并在皮肤不同的时候打上 data-skin-pending，
// 暂时隐藏服务端按 Cookie 渲染的那一套 DOM；客户端换成正确皮肤后由总布局摘掉。
// ============================================================

export type Skin = "paper" | "amber";
export type Theme = "light" | "dark";

export interface UiPrefs {
  skin: Skin;
  theme: Theme;
}

export const SKIN_KEY = "hellotime.skin";
export const THEME_KEY = "hellotime.theme";
export const SKIN_COOKIE = "ht-skin";
export const THEME_COOKIE = "ht-theme";
const COOKIE_MAX_AGE = 365 * 86400;

/** 浏览器地址栏颜色，跟着皮肤与明暗走 */
export const THEME_COLOR: Record<Skin, Record<Theme, string>> = {
  paper: { light: "#F3EFE5", dark: "#131210" },
  amber: { light: "#faf5ea", dark: "#080b1a" },
};

export const DEFAULT_PREFS: UiPrefs = { skin: "amber", theme: "dark" };

export const parseSkin = (v: string | null | undefined): Skin | null => (v === "paper" || v === "amber" ? v : null);
export const parseTheme = (v: string | null | undefined): Theme | null => (v === "light" || v === "dark" ? v : null);

/** 服务端：从 Cookie 读偏好；没有或不合法时用默认值（琥珀 · 星夜） */
export function prefsFromCookies(get: (name: string) => string | undefined): UiPrefs {
  return {
    skin: parseSkin(get(SKIN_COOKIE)) ?? DEFAULT_PREFS.skin,
    theme: parseTheme(get(THEME_COOKIE)) ?? DEFAULT_PREFS.theme,
  };
}

/** 浏览器：写一份 Cookie 副本（值没变就不写） */
export function writePrefCookie(name: typeof SKIN_COOKIE | typeof THEME_COOKIE, value: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (m?.[1] === value) return;
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * 首帧脚本（根布局 <head> 内联，早于正文解析执行）：
 * 皮肤 = localStorage → 服务端按 Cookie 写好的 data-skin；
 * 明暗 = localStorage → 系统偏好（与 React 参考前端一致：没选过就跟随系统）。
 * 只在值确实不同的时候才改 <html>，一致时不产生任何属性变更。
 */
export const FIRST_FRAME_SCRIPT = `(function () {
  var root = document.documentElement;
  var skin, theme;
  try {
    skin = localStorage.getItem(${JSON.stringify(SKIN_KEY)});
    theme = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  } catch (e) {}
  var served = root.getAttribute("data-skin");
  if (skin !== "paper" && skin !== "amber") skin = served === "paper" ? "paper" : "amber";
  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  if (served !== skin) {
    root.setAttribute("data-skin-pending", "");
    root.setAttribute("data-skin", skin);
  }
  if (root.getAttribute("data-theme") !== theme) root.setAttribute("data-theme", theme);
  var color = ${JSON.stringify(THEME_COLOR)}[skin][theme];
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta && meta.getAttribute("content") !== color) meta.setAttribute("content", color);
})();`;
