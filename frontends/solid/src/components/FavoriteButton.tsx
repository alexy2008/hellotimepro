import { createEffect, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { auth } from "@/stores/auth";
import { patchPlazaFavorited } from "@/stores/plaza";
import { api } from "@/api/client";
import { ApiError, type CapsuleListItem, type CapsuleDetail } from "@/types";

type FavCapsule = Pick<
  CapsuleListItem | CapsuleDetail,
  "id" | "favoritedByMe" | "favoriteCount"
>;

export function FavoriteButton(props: {
  capsule: FavCapsule;
  size?: "sm" | "md";
  onChange?: (favorited: boolean, count: number) => void;
}) {
  const navigate = useNavigate();

  const [active, setActive] = createSignal(props.capsule.favoritedByMe);
  const [count, setCount] = createSignal(props.capsule.favoriteCount);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  // props 变化时同步本地状态——避免父组件外部更新（详情页 / store patch）后仍显示旧值
  createEffect(() => {
    setActive(props.capsule.favoritedByMe);
    setCount(props.capsule.favoriteCount);
  });

  async function toggle() {
    setErr(null);

    if (!auth.user) {
      // 匿名用户：跳登录提示，而不是静默失败
      const yes = window.confirm("登录后才能收藏，前往登录？");
      if (yes) navigate("/login");
      return;
    }

    setBusy(true);
    try {
      if (active()) {
        await api.unfavorite(props.capsule.id);
        const next = Math.max(0, count() - 1);
        setActive(false);
        setCount(next);
        patchPlazaFavorited(props.capsule.id, false, next);
        props.onChange?.(false, next);
      } else {
        const r = await api.favorite(props.capsule.id);
        setActive(true);
        setCount(r.favoriteCount);
        patchPlazaFavorited(props.capsule.id, true, r.favoriteCount);
        props.onChange?.(true, r.favoriteCount);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show
      when={props.size === "md"}
      fallback={
        <button
          type="button"
          class={`cy-capsule__fav ${active() ? "is-active" : ""}`}
          onClick={toggle}
          disabled={busy()}
          title={err() ?? undefined}
        >
          {active() ? "♥" : "♡"} {count()}
        </button>
      }
    >
      <button
        type="button"
        class={`cy-btn cy-btn--accent ${active() ? "is-active" : ""}`}
        onClick={toggle}
        disabled={busy()}
        title={err() ?? undefined}
      >
        <span
          style={{
            color: active()
              ? "var(--color-favorite-active)"
              : "var(--color-favorite-inactive)",
          }}
        >
          {active() ? "♥" : "♡"}
        </span>
        收藏 · {count()}
      </button>
    </Show>
  );
}
