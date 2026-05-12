"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const apply = useThemeStore((s) => s.apply);

  useEffect(() => {
    apply();
  }, [apply]);

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
