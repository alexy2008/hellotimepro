import { defineStore } from "pinia";
import { ref } from "vue";

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

export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>("dark");

  function hydrate() {
    const t = read();
    apply(t);
    theme.value = t;
  }

  function set(t: Theme) {
    apply(t);
    theme.value = t;
  }

  function toggle() {
    set(theme.value === "dark" ? "light" : "dark");
  }

  return { theme, hydrate, set, toggle };
});
