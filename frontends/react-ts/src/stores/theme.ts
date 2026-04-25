import { create } from "zustand";

export type Theme = "dark" | "light";
const KEY = "hellotime.theme";

interface ThemeState {
  theme: Theme;
  hydrate: () => void;
  toggle: () => void;
  set: (t: Theme) => void;
}

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

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: "dark",
  hydrate: () => {
    const t = read();
    apply(t);
    set({ theme: t });
  },
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
  set: (t) => {
    apply(t);
    set({ theme: t });
  },
}));
