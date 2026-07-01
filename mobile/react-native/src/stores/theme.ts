// ============================================================
// 主题状态：dark / light，持久化到 AsyncStorage。
// 移植自 frontends/react-ts/src/stores/theme.ts。
// 差异：localStorage → AsyncStorage（异步）；无 document.documentElement，
// 主题由 usePalette()（@/theme）按 mode 取调色板，组件自行套用。
// ============================================================

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Theme = "dark" | "light";
const KEY = "hellotime.theme";

interface ThemeState {
  mode: Theme;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: () => void;
  setMode: (t: Theme) => void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
  mode: "dark",
  hydrated: false,

  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(KEY);
      set({ mode: v === "light" ? "light" : "dark", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  toggle: () => {
    const next = get().mode === "dark" ? "light" : "dark";
    set({ mode: next });
    AsyncStorage.setItem(KEY, next).catch(() => {});
  },

  setMode: (t) => {
    set({ mode: t });
    AsyncStorage.setItem(KEY, t).catch(() => {});
  },
}));
