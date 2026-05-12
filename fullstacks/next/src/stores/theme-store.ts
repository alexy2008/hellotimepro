"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  apply: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = next;
        }
      },
      apply: () => {
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = get().theme;
        }
      },
    }),
    {
      name: "hellotime-pro-theme",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
