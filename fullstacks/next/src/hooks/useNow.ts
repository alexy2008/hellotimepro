// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个定时器，对齐到整秒，
// 这样同一页上的十几个倒计时会在同一刻一起跳，不会参差。
//
// 服务端渲染与水合：两边的 Date.now() 不同，直接用会让倒计时文字水合不匹配。
// 根布局把「服务端渲染那一刻」经 NowSeedContext 传下来，作为 getServerSnapshot——
// 服务端与水合用同一个时刻渲染，水合完成后 React 再改读本机时钟。
// ============================================================

import { createContext, useContext, useSyncExternalStore } from "react";
import { dateFormat, fmt, SSR_TIME_ZONE } from "@/lib/fmt";

const serverDate = dateFormat(SSR_TIME_ZONE);
const subscribeToHydration = () => () => {};

/** 首次水合与服务端用同一时区，客户端接管后恢复访客的本地日期。 */
export function useDisplayDate() {
  return useSyncExternalStore(subscribeToHydration, () => fmt, () => serverDate);
}

const subs = new Set<() => void>();
let now = Date.now();
let timer = 0;

function loop() {
  timer = window.setTimeout(() => {
    now = Date.now();
    subs.forEach((fn) => fn());
    loop();
  }, 1000 - (Date.now() % 1000) + 4);
}

function subscribe(fn: () => void) {
  subs.add(fn);
  if (subs.size === 1) {
    now = Date.now();
    loop();
  }
  return () => {
    subs.delete(fn);
    if (!subs.size) clearTimeout(timer);
  };
}

/** 服务端渲染时刻（毫秒）；没有提供时退回模块里的时钟 */
export const NowSeedContext = createContext<number | null>(null);

/** 当前时间（毫秒），每整秒更新一次 */
export function useNow(): number {
  const seed = useContext(NowSeedContext);
  return useSyncExternalStore(subscribe, () => now, () => seed ?? now);
}
