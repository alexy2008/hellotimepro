import { useTheme } from "@/stores/theme";

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      type="button"
      className="cy-theme-toggle"
      aria-label="切换主题"
      onClick={toggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
