export type Skin = "paper" | "amber";
export type Theme = "light" | "dark";

export const SKIN_KEY = "hellotime.skin";
export const THEME_KEY = "hellotime.theme";
export const THEME_COLOR: Record<Skin, Record<Theme, string>> = {
  paper: { light: "#F3EFE5", dark: "#131210" },
  amber: { light: "#faf5ea", dark: "#080b1a" },
};

// SSR 从偏好 Cookie 选用对应视图。旧标签页或只预设 localStorage 的浏览器
// 仍以本地值为准，DOM 换到正确皮肤前暂时隐藏内容。
export const startupPreferences = `
(function () {
  var root = document.documentElement;
  var skin, theme;
  try {
    skin = localStorage.getItem(${JSON.stringify(SKIN_KEY)});
    theme = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  } catch (e) {}
  if (skin !== "paper" && skin !== "amber") skin = root.dataset.skin || "amber";
  if (theme !== "dark" && theme !== "light") {
    theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  if (root.dataset.skin && skin !== root.dataset.skin) root.dataset.skinPending = "";
  root.dataset.skin = skin;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", ${JSON.stringify(THEME_COLOR)}[skin][theme]);
})();
`;
