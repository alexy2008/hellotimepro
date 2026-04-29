import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { usePlaza } from "@/stores/plaza";
import { api } from "@/api/client";
import { ApiError, type CapsuleListItem, type CapsuleDetail } from "@/types";

interface Props {
  capsule: Pick<
    CapsuleListItem | CapsuleDetail,
    "id" | "favoritedByMe" | "favoriteCount"
  >;
  size?: "sm" | "md";
  onChange?: (favorited: boolean, count: number) => void;
}

export function FavoriteButton({ capsule, size = "sm", onChange }: Props) {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const patchPlaza = usePlaza((s) => s.patchFavorited);

  const [active, setActive] = useState(capsule.favoritedByMe);
  const [count, setCount] = useState(capsule.favoriteCount);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // props 变化时同步本地 state——避免父组件外部更新（如详情页 / store patch）
  // 后，本组件仍显示旧值。
  useEffect(() => {
    setActive(capsule.favoritedByMe);
    setCount(capsule.favoriteCount);
  }, [capsule.id, capsule.favoritedByMe, capsule.favoriteCount]);

  async function toggle() {
    setErr(null);

    if (!user) {
      // 匿名用户：跳登录提示，而不是静默失败
      const yes = window.confirm("登录后才能收藏，前往登录？");
      if (yes) navigate("/login");
      return;
    }

    setBusy(true);
    try {
      if (active) {
        await api.unfavorite(capsule.id);
        const next = Math.max(0, count - 1);
        setActive(false);
        setCount(next);
        patchPlaza(capsule.id, false, next);
        onChange?.(false, next);
      } else {
        const r = await api.favorite(capsule.id);
        setActive(true);
        setCount(r.favoriteCount);
        patchPlaza(capsule.id, true, r.favoriteCount);
        onChange?.(true, r.favoriteCount);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (size === "md") {
    return (
      <button
        type="button"
        className={`cy-btn cy-btn--accent ${active ? "is-active" : ""}`}
        onClick={toggle}
        disabled={busy}
        title={err ?? undefined}
      >
        <span style={{ color: active ? "var(--color-favorite-active)" : "var(--color-favorite-inactive)" }}>
          {active ? "♥" : "♡"}
        </span>
        收藏 · {count}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`cy-capsule__fav ${active ? "is-active" : ""}`}
      onClick={toggle}
      disabled={busy}
      title={err ?? undefined}
    >
      {active ? "♥" : "♡"} {count}
    </button>
  );
}
