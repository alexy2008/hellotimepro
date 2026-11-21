<!-- ============================================================
     收藏按钮：两套皮肤同一份标记（.fav），卡片与详情页共用。
     - 2.0 起任何胶囊都能收藏（自己的、未公开的都可以）
     - 匿名用户先弹确认框提示登录，确认后带 ?redirect= 去登录
     - 乐观更新：点了立刻变，请求失败再滚回去并提示
     on / count 是可写的 $derived：外部数据变了（列表刷新、另一处收藏）自动跟上，点击时就地改写
     ============================================================ -->
<script lang="ts">
  import { navigate } from "svelte-routing";
  import { api } from "@/api/client";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { plaza } from "@/stores/plaza.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { askLogin } from "@/state/login-prompt";
  import { loginPath } from "@/lib/redirect";
  import { fmt, reducedMotion } from "@/lib/fmt";
  import AppIcon from "@/components/AppIcon.svelte";

  interface Props {
    capsule: { id: string; favoritedByMe: boolean; favoriteCount: number };
    size?: "sm" | "md";
    onchange?: (favorited: boolean, count: number) => void;
  }
  let { capsule, size = "sm", onchange }: Props = $props();

  let on = $derived(capsule.favoritedByMe);
  let count = $derived(capsule.favoriteCount);
  /** 每次收藏加一：按钮以它为 key 重新挂载，is-pop 动画才会重播 */
  let pop = $state(0);
  let burst = $state(false);
  let busy = false;

  /** 爆开的七粒小点 */
  const dots = Array.from({ length: 7 }, (_, i) => ({ a: `${Math.round(i * 51.4 - 90)}deg`, d: `${15 + (i % 3) * 5}px` }));

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!authStore.user) {
      if (await askLogin("favorite")) navigate(loginPath(location.pathname + location.search));
      return;
    }
    if (busy) return;
    busy = true;
    const id = capsule.id;
    const owner = authStore.user.id;
    const next = !on;
    const prev = { on, count };
    const guess = Math.max(0, count + (next ? 1 : -1));
    on = next;
    count = guess;
    if (next) {
      pop++;
      burst = !reducedMotion();
      setTimeout(() => (burst = false), 720);
    }
    try {
      let final = guess;
      if (next) final = (await api.favorite(id)).favoriteCount;
      else {
        await api.unfavorite(id);
      }
      if (authStore.user?.id !== owner) return;
      if (!next) toast("已取消收藏");
      count = final;
      plaza.patchFavorited(id, next, final);
      onchange?.(next, final);
    } catch {
      if (authStore.user?.id !== owner) return;
      on = prev.on;
      count = prev.count;
      toast("收藏没有成功，请稍后再试", { tone: "error" });
    } finally {
      busy = false;
    }
  }
</script>

{#key pop}
  <button
    class={["fav", `fav--${size}`, { "is-on": on, "is-pop": pop }]}
    type="button"
    aria-pressed={on}
    aria-label={`${on ? "取消收藏" : "收藏"}，已有 ${count} 人收藏`}
    data-testid="fav-button"
    data-count={count}
    onclick={toggle}
  >
    <span class="fav__ic">
      <AppIcon name="heart" />
      {#if burst}
        <span class="burst">{#each dots as d, i (i)}<i style:--a={d.a} style:--d={d.d}></i>{/each}</span>
      {/if}
    </span>
    {#if size === "md"}<span class="fav__t">{on ? "已收藏" : "收藏"}</span>{/if}
    <span class="fav__n">{fmt.num(count)}</span>
  </button>
{/key}
