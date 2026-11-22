// ============================================================
// 界面状态：皮肤（时笺 / 琥珀）× 明暗。两个维度互相独立，
// 都写在 <html data-skin data-theme> 上，并持久化到 localStorage。
// 首帧之前的那一次由 index.html 的内联脚本完成，这里只负责之后的切换。
//
// SolidJS 习惯：全局状态用模块级 signal，导出只读 getter 与动作函数。
// signal 脱离组件树存在，任何组件读 skin() 就建立了细粒度订阅。
// ============================================================

import { createSignal } from "solid-js";
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

const [skin, setSkinSignal] = createSignal<Skin>(root().dataset.skin === "paper" ? "paper" : "amber");
const [theme, setThemeSignal] = createSignal<Theme>(root().dataset.theme === "light" ? "light" : "dark");
export { skin, theme };

function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 隐私模式等：只是记不住，不影响使用 */
  }
}

function syncMeta(s: Skin, t: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[s][t]);
}

/**
 * 用 View Transition 包一层：浏览器不支持、或减少动效时直接切。
 * Solid 的信号写入是同步落到 DOM 的，回调返回时新画面已经就绪，不必像 Vue 那样等 nextTick。
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
  return vt.finished.catch(() => undefined).finally(() => root().classList.remove(cls));
}

export function setSkin(next: Skin): Promise<void> {
  if (next === skin()) return Promise.resolve();
  // 开关上时笺在左、琥珀在右：转场方向跟着走（见 spec/styles/shell.css）
  const dir = next === "paper" ? "prev" : "next";
  root().dataset.skinDir = dir;
  return transition(() => {
    root().dataset.skin = next;
    save(SKIN_KEY, next);
    syncMeta(next, theme());
    setSkinSignal(next);
  }, "is-skinning").finally(() => {
    // 转场中途又切了一次：方向已经是新的，别删
    if (root().dataset.skinDir === dir) delete root().dataset.skinDir;
  });
}

/** origin：点击位置，明暗切换从这里圆形晕开 */
export function toggleTheme(origin?: { x: number; y: number }) {
  const next: Theme = theme() === "dark" ? "light" : "dark";
  const x = origin?.x ?? window.innerWidth - 80;
  const y = origin?.y ?? 32;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  void transition(
    () => {
      root().dataset.theme = next;
      save(THEME_KEY, next);
      syncMeta(skin(), next);
      setThemeSignal(next);
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
