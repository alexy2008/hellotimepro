// ============================================================
// 界面状态：皮肤（时笺 / 琥珀）× 明暗。两个维度互相独立，
// 都写在 <html data-skin data-theme> 上，并持久化到 localStorage。
// 首帧之前的那一次由根布局（app/layout.tsx）<head> 里的内联脚本完成，这里只负责之后的切换。
// ============================================================

import { create } from "zustand";
import { reducedMotion } from "@/lib/fmt";

export type Skin = "paper" | "amber";
export type Theme = "light" | "dark";

export const SKIN_LABEL: Record<Skin, string> = { paper: "时笺", amber: "琥珀" };
export const THEME_LABEL: Record<Skin, Record<Theme, string>> = {
  paper: { light: "昼", dark: "夜" },
  amber: { light: "晨曦", dark: "星夜" },
};
/** 浏览器地址栏颜色，跟着皮肤与明暗走 */
const THEME_COLOR: Record<Skin, Record<Theme, string>> = {
  paper: { light: "#F3EFE5", dark: "#131210" },
  amber: { light: "#faf5ea", dark: "#080b1a" },
};

const SKIN_KEY = "hellotime.skin";
const THEME_KEY = "hellotime.theme";

const root = () => document.documentElement;

function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 隐私模式等：只是记不住，不影响使用 */
  }
}

function syncMeta(skin: Skin, theme: Theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[skin][theme]);
}

/**
 * 用 View Transition 包一层：浏览器不支持、或减少动效时直接切。
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
  const vt = document.startViewTransition(run);
  setTimeout(run, 400);
  after?.(vt);
  return vt.finished
    .catch(() => undefined)
    .finally(() => root().classList.remove(cls));
}

interface UiState {
  skin: Skin;
  theme: Theme;
  setSkin: (s: Skin) => Promise<void>;
  /** origin：点击位置，明暗切换从这里圆形晕开 */
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

// 服务端求值本模块时没有 document（页面组件的模块图在 SSR 里也会被加载），
// 初值只在浏览器里从 <html> 上读；整棵应用树只在客户端渲染（components/ClientRoot）。
const hasDom = typeof document !== "undefined";

export const useUi = create<UiState>()((set, get) => ({
  skin: hasDom && root().dataset.skin === "paper" ? "paper" : "amber",
  theme: hasDom && root().dataset.theme === "light" ? "light" : "dark",

  setSkin: (skin) => {
    if (skin === get().skin) return Promise.resolve();
    // 开关上时笺在左、琥珀在右：转场方向跟着走（见 spec/styles/shell.css）
    const dir = skin === "paper" ? "prev" : "next";
    root().dataset.skinDir = dir;
    return transition(() => {
      root().dataset.skin = skin;
      save(SKIN_KEY, skin);
      syncMeta(skin, get().theme);
      set({ skin });
    }, "is-skinning").finally(() => {
      // 转场中途又切了一次：方向已经是新的，别删
      if (root().dataset.skinDir === dir) delete root().dataset.skinDir;
    });
  },

  toggleTheme: (origin) => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    const x = origin?.x ?? window.innerWidth - 80;
    const y = origin?.y ?? 32;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    void transition(
      () => {
        root().dataset.theme = next;
        save(THEME_KEY, next);
        syncMeta(get().skin, next);
        set({ theme: next });
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
  },
}));
