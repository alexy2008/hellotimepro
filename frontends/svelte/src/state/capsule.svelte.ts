// ============================================================
// 胶囊详情（两套皮肤共用）。路由按码给页面加了 {#key}，
// 所以一个实例只对应一枚胶囊；换码就是换一个实例。
// ============================================================

import { createContext, untrack } from "svelte";
import { api } from "@/api/client";
import { authStore } from "@/stores/auth.svelte.ts";
import { clock } from "@/stores/clock.svelte.ts";
import { ApiError, type CapsuleDetail, type CapsuleListItem } from "@/types";
import { ms, sleep } from "@/lib/fmt";

export type DetailStatus = "loading" | "ok" | "missing" | "error";

/**
 * 按码取胶囊。未开启时逐秒倒数，归零那一刻 expired 变 true——
 * 皮肤据此播放开启动画，并调用 awaitOpened(signal) 拿到正文（不用刷新页面）。
 */
export class CapsuleState {
  capsule = $state.raw<CapsuleDetail | null>(null);
  status = $state<DetailStatus>("loading");
  expired = $derived(!!this.capsule && !this.capsule.isOpened && ms(this.capsule.openAt) <= clock.now);
  /** 离开页面就加一，作废进行中的等待 */
  #gen = 0;
  /** 取数序列号：只认最后一次 */
  #loadSeq = 0;

  constructor(readonly code: string) {
    // 登录态变了，favoritedByMe 也会变：重新取一次
    $effect(() => {
      void authStore.user?.id;
      untrack(() => void this.load());
    });
    $effect(() => () => void this.#gen++);
    $effect(() => {
      if (this.capsule) document.title = `${this.capsule.title} · HelloTime Pro`;
    });
  }

  load = async () => {
    const my = ++this.#loadSeq;
    const g = this.#gen;
    const stale = () => my !== this.#loadSeq || g !== this.#gen;
    try {
      const d = await api.capsuleByCode(this.code);
      if (stale()) return null;
      this.capsule = d;
      this.status = "ok";
      return d;
    } catch (e) {
      if (!stale()) this.status = e instanceof ApiError && e.status === 404 ? "missing" : "error";
      return null;
    }
  };

  /**
   * 倒数归零后取正文：以服务端的 isOpened 为准。本机时钟可能比服务端快几秒，
   * 这时接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次），直到真正开启；
   * 离开页面或胶囊已被删除（404）时返回 null
   */
  awaitOpened = async (signal: AbortSignal): Promise<CapsuleDetail | null> => {
    const my = this.#gen;
    for (let i = 0; my === this.#gen && !signal.aborted; i++) {
      try {
        const d = await api.capsuleByCode(this.code);
        if (my !== this.#gen || signal.aborted) return null;
        if (d.isOpened) {
          this.capsule = d;
          return d;
        }
      } catch (e) {
        if (my !== this.#gen || signal.aborted) return null;
        if (e instanceof ApiError && e.status === 404) {
          this.status = "missing";
          return null;
        }
      }
      await sleep(Math.min(1000 * (i + 1), 5000));
    }
    return null;
  };
}

const [get, set] = createContext<CapsuleState>();
export const provideCapsule = (code: string) => set(new CapsuleState(code));
export const useCapsule = get;

/** 开启页「我封存过的胶囊」：登录后取最近 3 枚 */
export class MySealed {
  items = $state.raw<CapsuleListItem[]>([]);
  #seq = 0;

  constructor() {
    $effect(() => {
      const id = authStore.user?.id;
      const my = ++this.#seq;
      if (!id) return void (this.items = []);
      untrack(() =>
        api
          .myCapsules(1, 3)
          .then((r) => my === this.#seq && (this.items = r.items))
          .catch(() => undefined),
      );
    });
    $effect(() => () => void this.#seq++);
  }
}

/** 正文按空行分段，每段再按单个换行拆成行 */
export const paragraphs = (text: string | null | undefined) =>
  String(text ?? "")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => p.split("\n"));
