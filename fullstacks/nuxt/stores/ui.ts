// ============================================================
// 界面状态：皮肤（时笺 / 琥珀）× 明暗。两个维度互相独立，
// 都写在 <html data-skin data-theme> 上，并持久化到 localStorage。
// 首帧之前的那一次由 nuxt.config.ts 的内联脚本完成，这里只负责之后的切换。
// ============================================================

import { defineStore } from "pinia";
import { nextTick, ref } from "vue";
import { reducedMotion } from "@/lib/fmt";

import { SKIN_KEY, THEME_KEY, THEME_COLOR, type Skin, type Theme } from "@/lib/preferences";

export type { Skin, Theme } from "@/lib/preferences";
export const SKINS: Skin[] = ["paper", "amber"];
export const SKIN_LABEL: Record<Skin, string> = { paper: "时笺", amber: "琥珀" };

const root = () => document.documentElement;

function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 隐私模式等：只是记不住，不影响使用 */
  }
}

function syncMeta(skin: Skin, theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[skin][theme]);
}

/**
 * 用 View Transition 包一层：浏览器不支持、或减少动效时直接切。
 * 回调里改完状态再等一个 nextTick，浏览器拍「新画面」时 Vue 已经把 DOM 换好了。
 * 页面在后台时转场回调可能被节流，400ms 内没跑就兜底直接切。
 */
function transition(apply: () => void, cls: string, after?: (vt: ViewTransition) => void): Promise<void> {
  if (!document.startViewTransition || reducedMotion()) {
    apply();
    return Promise.resolve();
  }
  root().classList.add(cls);
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    apply();
  };
  const vt = document.startViewTransition(() => {
    run();
    return nextTick();
  });
  setTimeout(run, 400);
  after?.(vt);
  return vt.finished.catch(() => undefined).finally(() => root().classList.remove(cls));
}

export const useUiStore = defineStore("ui", () => {
  const skin = ref<Skin>("amber");
  const theme = ref<Theme>("dark");
  const skinCookie = useCookie<Skin>("ht-skin", { maxAge: 365 * 86400, sameSite: "lax" });

  function restore(preferences?: DOMStringMap) {
    if (import.meta.server) {
      skin.value = skinCookie.value === "paper" ? "paper" : "amber";
      return;
    }
    skin.value = preferences?.skin === "paper" ? "paper" : "amber";
    theme.value = preferences?.theme === "light" ? "light" : "dark";
    root().dataset.skin = skin.value;
    root().dataset.theme = theme.value;
    syncMeta(skin.value, theme.value);
    skinCookie.value = skin.value;
    void nextTick(() => delete root().dataset.skinPending);
  }

  function setSkin(next: Skin): Promise<void> {
    if (next === skin.value) return Promise.resolve();
    // 开关上时笺在左、琥珀在右：转场方向跟着走（见 spec/styles/shell.css）
    root().dataset.skinDir = next === "paper" ? "prev" : "next";
    return transition(() => {
      root().dataset.skin = next;
      save(SKIN_KEY, next);
      skinCookie.value = next;
      syncMeta(next, theme.value);
      skin.value = next;
    }, "is-skinning").finally(() => {
      delete root().dataset.skinDir;
    });
  }

  /** origin：点击位置，明暗切换从这里圆形晕开 */
  function toggleTheme(origin?: { x: number; y: number }) {
    const next: Theme = theme.value === "dark" ? "light" : "dark";
    const x = origin?.x ?? window.innerWidth - 80;
    const y = origin?.y ?? 32;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    void transition(
      () => {
        root().dataset.theme = next;
        save(THEME_KEY, next);
        syncMeta(skin.value, next);
        theme.value = next;
      },
      "is-theming",
      (vt) => {
        // 一盏灯被拧亮或熄灭：新画面从点击处圆形晕开
        vt.ready
          .then(() =>
            root().animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
              { duration: 600, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" },
            ),
          )
          .catch(() => undefined);
      },
    );
  }

  return { skin, theme, restore, setSkin, toggleTheme };
});
