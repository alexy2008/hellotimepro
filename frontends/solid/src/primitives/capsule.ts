// ============================================================
// 胶囊详情与开启页的共享逻辑（两套皮肤共用）
// ============================================================

import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { api } from "@/api/client";
import { auth } from "@/stores/auth";
import { ApiError, type CapsuleDetail, type CapsuleListItem } from "@/types";
import { copyText } from "@/stores/feedback";
import { useNow } from "@/primitives/now";
import { ms, sleep } from "@/lib/fmt";

export type DetailStatus = "loading" | "ok" | "missing" | "error";

/**
 * 按码取胶囊。路由页按 code 建一份（换码就整份重建），交给皮肤视图。
 * 未开启时逐秒倒数，归零那一刻 expired 变 true——
 * 皮肤据此播放开启动画，并调用 awaitOpened(signal) 拿到正文（不用刷新页面）。
 */
export function createCapsuleByCode(code: string) {
  const [c, setC] = createSignal<CapsuleDetail | null>(null);
  const [status, setStatus] = createSignal<DetailStatus>("loading");
  const now = useNow();
  let favoriteVersion = 0;

  function updateFavorite(favoritedByMe: boolean, favoriteCount: number) {
    favoriteVersion++;
    setC((current) => current && { ...current, favoritedByMe, favoriteCount });
  }

  function applyDetail(detail: CapsuleDetail, readVersion: number) {
    setC((current) =>
      current && favoriteVersion !== readVersion
        ? { ...detail, favoritedByMe: current.favoritedByMe, favoriteCount: current.favoriteCount }
        : detail,
    );
  }

  let gen = 0; // 离开页面、登录态变了就作废进行中的请求
  onCleanup(() => gen++);

  async function load() {
    const my = ++gen;
    const readVersion = favoriteVersion;
    try {
      const d = await api.capsuleByCode(code);
      if (my !== gen) return null;
      applyDetail(d, readVersion);
      setStatus("ok");
      return d;
    } catch (e) {
      if (my !== gen) return null;
      setStatus(e instanceof ApiError && e.status === 404 ? "missing" : "error");
      return null;
    }
  }

  // 进入时、登录态变化（favoritedByMe 会变）时重新取
  createEffect(
    on(
      () => auth.user?.id,
      () => {
        setStatus("loading");
        setC(null);
        void load();
      },
    ),
  );

  /**
   * 倒数归零后取正文：以服务端的 isOpened 为准。本机时钟可能比服务端快几秒，
   * 这时接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次），直到真正开启；
   * 视图销毁（离页、换码、换皮肤）时 abort，或胶囊已被删除（404）时返回 null
   */
  async function awaitOpened(signal: AbortSignal): Promise<CapsuleDetail | null> {
    const generation = gen;
    for (let i = 0; !signal.aborted && generation === gen; i++) {
      const readVersion = favoriteVersion;
      try {
        const d = await api.capsuleByCode(code);
        if (signal.aborted || generation !== gen) return null;
        if (d.isOpened) {
          applyDetail(d, readVersion);
          return d;
        }
      } catch (e) {
        if (signal.aborted || generation !== gen) return null;
        if (e instanceof ApiError && e.status === 404) {
          setC(null);
          setStatus("missing");
          return null;
        }
      }
      await sleep(Math.min(1000 * (i + 1), 5000));
    }
    return null;
  }

  createEffect(() => {
    const d = c();
    if (d) document.title = `${d.title} · HelloTime Pro`;
  });

  const expired = createMemo(() => {
    const d = c();
    return !!d && !d.isOpened && ms(d.openAt) <= now();
  });

  return { code, c, status, now, expired, reload: load, awaitOpened, updateFavorite };
}

export type CapsuleByCode = ReturnType<typeof createCapsuleByCode>;

/** 复制码与分享链接 */
export function shareOf(code: string) {
  return {
    copyCode: () => void copyText(code, `已复制胶囊码 ${code}`),
    copyLink: () => void copyText(`${window.location.origin}/capsules/${code}`, "已复制分享链接"),
  };
}

/** 开启页「我封存过的胶囊」：登录后取最近 3 枚 */
export function createMySealed() {
  const [items, setItems] = createSignal<CapsuleListItem[]>([]);
  createEffect(
    on(
      () => auth.user?.id,
      (id) => {
        setItems([]);
        if (!id) return;
        let alive = true;
        let timer = 0;

        async function load() {
          let delay: number | undefined;
          try {
            const { items: recent } = await api.myCapsules(1, 3);
            if (!alive) return;
            setItems(recent);
            const next = Math.min(...recent.filter((item) => !item.isOpened).map((item) => ms(item.openAt)));
            if (Number.isFinite(next)) delay = Math.max(1000, next - Date.now());
          } catch {
            delay = 5000;
          }
          if (alive && delay !== undefined) {
            // 很远的开启时刻也能安全交给浏览器计时。
            timer = window.setTimeout(() => void load(), Math.min(delay, 2_147_483_647));
          }
        }

        void load();
        onCleanup(() => {
          alive = false;
          clearTimeout(timer);
        });
      },
    ),
  );
  return items;
}

/** 正文按空行分段 */
export const paragraphs = (text: string | null | undefined) =>
  String(text ?? "")
    .split(/\n{2,}/)
    .filter((p) => p.trim());
