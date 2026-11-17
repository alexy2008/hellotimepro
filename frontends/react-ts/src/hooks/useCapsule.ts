// ============================================================
// 胶囊详情与开启页的共享逻辑（两套皮肤共用）
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError, type CapsuleDetail, type CapsuleListItem } from "@/types";
import { copyText } from "@/stores/feedback";
import { useNow } from "@/hooks/useNow";
import { ms } from "@/lib/fmt";

/**
 * 按码取胶囊。未开启时逐秒倒数，归零那一刻 expired 变 true——
 * 皮肤据此播放开启动画，并调用 reload() 拿到正文（不用刷新页面）。
 */
export function useCapsuleByCode(code: string) {
  const user = useAuth((s) => s.user);
  const [c, setC] = useState<CapsuleDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const now = useNow();

  const load = useCallback(async () => {
    try {
      const d = await api.capsuleByCode(code);
      setC(d);
      setStatus("ok");
      return d;
    } catch (e) {
      setStatus(e instanceof ApiError && e.status === 404 ? "missing" : "error");
      return null;
    }
  }, [code]);

  useEffect(() => {
    setStatus("loading");
    setC(null);
    void load();
    // 登录态变了，favoritedByMe 也会变
  }, [load, user?.id]);

  useEffect(() => {
    if (c) document.title = `${c.title} · HelloTime Pro`;
  }, [c]);

  const expired = !!c && !c.isOpened && ms(c.openAt) <= now;
  return { c, setC, status, now, expired, reload: load };
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
