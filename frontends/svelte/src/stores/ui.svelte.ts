// ============================================================
// 界面状态：皮肤（时笺 / 琥珀）× 明暗。两个维度互相独立，
// 都写在 <html data-skin data-theme> 上，并持久化到 localStorage。
// 首帧之前的那一次由 index.html 的内联脚本完成，这里只负责之后的切换。
// ============================================================

import { tick } from "svelte";
import { reducedMotion } from "@/lib/fmt";

export type Skin = "paper" | "amber";
export type Theme = "light" | "dark";

export const SKINS: Skin[] = ["paper", "amber"];
export const SKIN_LABEL: Record<Skin, string> = { paper: "时笺", amber: "琥珀" };
/** 浏览器地址栏颜色，跟着皮肤与明暗走（与 index.html 的内联脚本同一张表） */
const THEME_COLOR: Record<Skin, Record<Theme, string>> = {
  paper: { light: "#F3EFE5", dark: "#131210" },
  amber: { light: "#faf5ea", dark: "#080b1a" },
};

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
 * 回调里改完状态再 await tick()，浏览器拍「新画面」时 Svelte 已经把 DOM 换好了。
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
  const vt = document.startViewTransition(async () => {
    run();
    await tick();
  });
  setTimeout(run, 400);
  after?.(vt);
  return vt.finished.catch(() => undefined).finally(() => root().classList.remove(cls));
}

class UiStore {
  skin = $state<Skin>(root().dataset.skin === "paper" ? "paper" : "amber");
  theme = $state<Theme>(root().dataset.theme === "light" ? "light" : "dark");

  setSkin(next: Skin): Promise<void> {
    if (next === this.skin) return Promise.resolve();
    // 开关上时笺在左、琥珀在右：转场方向跟着走（见 spec/styles/shell.css）
    const dir = next === "paper" ? "prev" : "next";
    root().dataset.skinDir = dir;
    return transition(() => {
      root().dataset.skin = next;
      save("hellotime.skin", next);
      syncMeta(next, this.theme);
      this.skin = next;
    }, "is-skinning").finally(() => {
      // 转场中途又切了一次：方向已经是新的，别删
      if (root().dataset.skinDir === dir) delete root().dataset.skinDir;
    });
  }

  /** origin：点击位置，明暗切换从这里圆形晕开 */
  toggleTheme(origin?: { x: number; y: number }) {
    const next: Theme = this.theme === "dark" ? "light" : "dark";
    const x = origin?.x ?? window.innerWidth - 80;
    const y = origin?.y ?? 32;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    void transition(
      () => {
        root().dataset.theme = next;
        save("hellotime.theme", next);
        syncMeta(this.skin, next);
        this.theme = next;
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
}

export const ui = new UiStore();

/** 明暗切换从点击位置晕开；键盘触发（坐标为 0）时从按钮中心晕开 */
export function themeOrigin(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const kb = e.clientX === 0 && e.clientY === 0;
  return { x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY };
}
