<script lang="ts">
  import { navigate, useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { plazaStore } from "@/stores/plaza.svelte.ts";
  import { api } from "@/api/client";
  import { ApiError } from "@/types";
  import type { CapsuleListItem, CapsuleDetail } from "@/types";

  interface Props {
    capsule: Pick<
      CapsuleListItem | CapsuleDetail,
      "id" | "favoritedByMe" | "favoriteCount"
    >;
    size?: "sm" | "md";
    onChange?: (favorited: boolean, count: number) => void;
  }

  let { capsule, size = "sm", onChange }: Props = $props();

  const location = useLocation();

  let active = $state(false);
  let count = $state(0);
  let busy = $state(false);
  let err = $state<string | null>(null);

  // 把 props 拍到本地 state：挂载时初始化，capsule 切换时同步。
  // 父组件如果做了乐观更新（patchFavorited 后回写新对象），这里也会跟着刷新。
  $effect(() => {
    active = capsule.favoritedByMe;
    count = capsule.favoriteCount;
  });

  const favoriteColor = $derived(
    active
      ? "var(--color-favorite-active)"
      : "var(--color-favorite-inactive)",
  );

  async function toggle() {
    err = null;

    if (!authStore.user) {
      // 匿名用户：跳登录，带上当前页路径以便登录后回来
      const yes = window.confirm("登录后才能收藏，前往登录？");
      if (yes) {
        const from = encodeURIComponent($location.pathname + $location.search);
        navigate(`/login?from=${from}`);
      }
      return;
    }

    busy = true;
    try {
      if (active) {
        await api.unfavorite(capsule.id);
        const next = Math.max(0, count - 1);
        active = false;
        count = next;
        plazaStore.patchFavorited(capsule.id, false, next);
        onChange?.(false, next);
      } else {
        const r = await api.favorite(capsule.id);
        active = true;
        count = r.favoriteCount;
        plazaStore.patchFavorited(capsule.id, true, r.favoriteCount);
        onChange?.(true, r.favoriteCount);
      }
    } catch (e) {
      err = e instanceof ApiError ? e.message : "操作失败";
    } finally {
      busy = false;
    }
  }
</script>

{#if size === "md"}
  <button
    type="button"
    class={["cy-btn", "cy-btn--accent", active ? "is-active" : ""].join(" ")}
    disabled={busy}
    title={err ?? undefined}
    onclick={toggle}
  >
    <span style:color={favoriteColor}>{active ? "♥" : "♡"}</span>
    收藏 · {count}
  </button>
{:else}
  <button
    type="button"
    class={["cy-capsule__fav", active ? "is-active" : ""].join(" ")}
    disabled={busy}
    title={err ?? undefined}
    onclick={toggle}
  >
    {active ? "♥" : "♡"} {count}
  </button>
{/if}
