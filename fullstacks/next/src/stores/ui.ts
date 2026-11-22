// ============================================================
// 界面状态：皮肤（时笺 / 琥珀）× 明暗。两个维度互相独立，
// 都写在 <html data-skin data-theme> 上，持久化到 localStorage，并同步一份到 Cookie
// （服务端据此选皮肤渲染，约定见 lib/preferences.ts）。
//
// 服务端渲染与水合：store 是模块级单例，服务端不能按请求改它。
// 所以 useUi 在「服务端渲染」和「客户端水合」这两次渲染里读的是根布局按 Cookie 传下来的
// UiSeedContext（useSyncExternalStore 的 getServerSnapshot），两边一致、不会水合不匹配；
// 水合完成后 React 再改读 store 的真实值（首帧脚本已按 localStorage 写好的 <html>），
// 不一致就重渲一次——这一刻的内容由 data-skin-pending 藏着，见 components/AppLayout。
// ============================================================

import { createContext, useContext, useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import { reducedMotion } from "@/lib/fmt";
import {
  DEFAULT_PREFS,
  SKIN_COOKIE,
  SKIN_KEY,
  THEME_COLOR,
  THEME_COOKIE,
  THEME_KEY,
  writePrefCookie,
  type Skin,
  type Theme,
  type UiPrefs,
} from "@/lib/preferences";

export type { Skin, Theme } from "@/lib/preferences";

export const SKIN_LABEL: Record<Skin, string> = { paper: "时笺", amber: "琥珀" };
export const THEME_LABEL: Record<Skin, Record<Theme, string>> = {
  paper: { light: "昼", dark: "夜" },
  amber: { light: "晨曦", dark: "星夜" },
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

export interface UiState {
  skin: Skin;
  theme: Theme;
  setSkin: (s: Skin) => Promise<void>;
  /** origin：点击位置，明暗切换从这里圆形晕开 */
  toggleTheme: (origin?: { x: number; y: number }) => void;
  /** 水合后调用一次：把 Cookie 校正成当前（localStorage 为准的）偏好，下次服务端就能直接渲染对 */
  syncCookies: () => void;
}

// 浏览器里初值取自 <html>：首帧脚本已经按 localStorage（没有则 Cookie / 系统偏好）写好。
// 服务端求值本模块时没有 document，用默认值占位——服务端渲染不读它，读的是 UiSeedContext。
const hasDom = typeof document !== "undefined";

const store = createStore<UiState>()((set, get) => ({
  skin: hasDom ? (root().dataset.skin === "paper" ? "paper" : "amber") : DEFAULT_PREFS.skin,
  theme: hasDom ? (root().dataset.theme === "light" ? "light" : "dark") : DEFAULT_PREFS.theme,

  setSkin: (skin) => {
    if (skin === get().skin) return Promise.resolve();
    // 开关上时笺在左、琥珀在右：转场方向跟着走（见 spec/styles/shell.css）
    const dir = skin === "paper" ? "prev" : "next";
    root().dataset.skinDir = dir;
    return transition(() => {
      root().dataset.skin = skin;
      save(SKIN_KEY, skin);
      writePrefCookie(SKIN_COOKIE, skin);
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
        writePrefCookie(THEME_COOKIE, next);
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

  syncCookies: () => {
    const { skin, theme } = get();
    writePrefCookie(SKIN_COOKIE, skin);
    writePrefCookie(THEME_COOKIE, theme);
  },
}));

/** 根布局按 Cookie 算出的偏好：服务端渲染与水合那一次渲染用它 */
export const UiSeedContext = createContext<UiPrefs>(DEFAULT_PREFS);

/**
 * 读界面状态：用法与 zustand 的 `useStore(selector)` 相同。
 * 服务端渲染与水合时用 UiSeedContext 覆盖 skin / theme，其余时候读 store。
 */
function useUiHook<T>(selector: (s: UiState) => T): T {
  const seed = useContext(UiSeedContext);
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector({ ...store.getState(), ...seed }),
  );
}

export const useUi = Object.assign(useUiHook, { getState: store.getState, subscribe: store.subscribe });
