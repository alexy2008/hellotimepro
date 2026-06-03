import { theme, toggleTheme } from "@/stores/theme";

export function ThemeToggle() {
  return (
    <button
      type="button"
      class="cy-theme-toggle"
      aria-label="切换主题"
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{theme() === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
