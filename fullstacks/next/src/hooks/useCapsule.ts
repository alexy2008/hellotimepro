// ============================================================
// 胶囊详情与开启页的共享逻辑（两套皮肤共用）
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { getSessionVersion, useAuth } from "@/stores/auth";
import { ApiError, type CapsuleDetail, type CapsuleListItem, type CapsuleSeed } from "@/types";
import { copyText } from "@/stores/feedback";
import { useNow } from "@/hooks/useNow";
import { ms, sleep } from "@/lib/fmt";

/**
 * 按码取胶囊。未开启时逐秒倒数，归零那一刻 expired 变 true——
 * 皮肤据此播放开启动画，并调用 awaitOpened(signal) 拿到正文（不用刷新页面）。
 *
 * initial 是服务端以匿名身份取好的第一屏。接管后后台复验历史路由数据，并补上 favoritedByMe。
 * 这个 hook 在路由层（views/CapsuleByCodePage）调用一次，两套皮肤共用同一份数据，换肤不重取。
 */
export function useCapsuleByCode(code: string, initial: CapsuleSeed | null = null) {
  const user = useAuth((s) => s.user);
  const session = useAuth((s) => s.hydrated ? getSessionVersion() : null);
  const [c, setC] = useState<CapsuleDetail | null>(initial?.status === "ok" ? initial.capsule : null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">(initial ? initial.status : "loading");
  const now = useNow();
  const gen = useRef(0); // 换了码或离开页面就作废进行中的等待
  const [favoriteSession, setFavoriteSession] = useState<number | null>(null);
  const [favoriteFailed, setFavoriteFailed] = useState(false);

  /** silent：补个人投影用，失败时保留已显示的内容（查无此码除外） */
  const load = useCallback(async (silent = false) => {
    const my = ++gen.current;
    const session = getSessionVersion();
    setFavoriteSession(null);
    setFavoriteFailed(false);
    try {
      const d = await api.capsuleByCode(code);
      if (my !== gen.current || session !== getSessionVersion()) return null;
      setC(d);
      setStatus("ok");
      setFavoriteSession(session);
      return d;
    } catch (e) {
      if (my !== gen.current || session !== getSessionVersion()) return null;
      const missing = e instanceof ApiError && e.status === 404;
      if (silent && !missing) {
        setFavoriteFailed(true);
        return null;
      }
      if (missing) setC(null);
      setStatus(missing ? "missing" : "error");
      return null;
    }
  }, [code]);

  // App Router 可以复用历史路由里的首屏。每次进入详情都在后台确认一次。
  useEffect(() => {
    if (session === null) return;
    void load(initial !== null);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void load(true);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      gen.current++;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [load, initial, user?.id, session]);

  const favoriteReady = session !== null && favoriteSession === session;
  const retryFavorite = useCallback(() => { void load(true); }, [load]);
  function patchFavorite(id: string, favorited: boolean, count: number) {
    setC((current) => current?.id === id
      ? { ...current, favoritedByMe: favorited, favoriteCount: count }
      : current);
  }

  /**
   * 倒数归零后取正文：以服务端的 isOpened 为准。本机时钟可能比服务端快几秒，
   * 这时接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次），直到真正开启；
   * 离开页面、换了码或胶囊已被删除（404）时返回 null
   */
  const awaitOpened = useCallback(async (signal: AbortSignal): Promise<CapsuleDetail | null> => {
    for (let i = 0; !signal.aborted; i++) {
      const session = getSessionVersion();
      try {
        const d = await api.capsuleByCode(code);
        if (signal.aborted) return null;
        if (session === getSessionVersion() && d.isOpened) {
          setC((current) => current && d);
          return d;
        }
      } catch (e) {
        if (signal.aborted) return null;
        if (session === getSessionVersion() && e instanceof ApiError && e.status === 404) {
          setC(null);
          setStatus("missing");
          return null;
        }
      }
      await sleep(Math.min(1000 * (i + 1), 5000));
    }
    return null;
  }, [code]);

  const expired = !!c && !c.isOpened && ms(c.openAt) <= now;
  const reload = useCallback(() => load(), [load]);
  return { c, status, now, expired, reload, awaitOpened, favoriteReady, favoriteFailed, retryFavorite, patchFavorite };
}

/** 复制码与分享链接 */
export function useShare(code: string) {
  return {
    copyCode: () => void copyText(code, `已复制胶囊码 ${code}`),
    copyLink: () => void copyText(`${window.location.origin}/capsules/${code}`, "已复制分享链接"),
  };
}

/** 开启页「我封存过的胶囊」：登录后取最近 3 枚 */
export function useMySealed() {
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState<CapsuleListItem[]>([]);
  useEffect(() => {
    if (!user) return setItems([]);
    let alive = true;
    api
      .myCapsules(1, 3)
      .then((r) => alive && setItems(r.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user?.id]);
  return items;
}

/** 正文按空行分段 */
export const paragraphs = (text: string | null | undefined) =>
  String(text ?? "")
    .split(/\n{2,}/)
    .filter((p) => p.trim());

export type CapsuleView = ReturnType<typeof useCapsuleByCode>;
