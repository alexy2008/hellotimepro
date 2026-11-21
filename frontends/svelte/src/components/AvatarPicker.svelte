<!-- ============================================================
     头像选择：时笺是十枚邮票（选中的被盖上一枚带对勾的小邮戳），琥珀是十颗小星球。
     单选组：方向键在选项间移动。值用 bind:value。
     ============================================================ -->
<script lang="ts">
  import { tick } from "svelte";
  import { ui } from "@/stores/ui.svelte.ts";
  import { avatarOf } from "@/lib/avatars";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import PaperAvatarStamp from "@/skins/paper/PaperAvatarStamp.svelte";

  let { value = $bindable(), ids }: { value: string; ids: string[] } = $props();
  let box = $state<HTMLElement>();
  const cur = $derived(avatarOf(value));

  async function move(dir: number) {
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(value));
    const n = ids[(i + dir + ids.length) % ids.length];
    value = n;
    await tick();
    box?.querySelector<HTMLElement>(`[data-value="${n}"]`)?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    void move(dir);
  }
</script>

<div bind:this={box} class="avpick" role="radiogroup" aria-label="选择头像" tabindex="-1" {onkeydown}>
  {#each ids as id (id)}
    {@const a = avatarOf(id)}
    <button
      type="button"
      class={["avpick__it", id === value && "is-sel"]}
      role="radio"
      aria-checked={id === value}
      tabindex={id === value ? 0 : -1}
      aria-label={`${a.name}，${a.tagline}`}
      data-testid="avatar-option"
      data-value={id}
      data-selected={id === value}
      onclick={() => (value = id)}
    >
      {#if ui.skin === "paper"}
        <PaperAvatarStamp {id} />
        <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
          <circle cx="51" cy="65" r="14.5" />
          <circle cx="51" cy="65" r="10.5" />
          <path d="M45.5 65.5l4 4 7.5-8.5" />
        </svg>
      {:else}
        <AppAvatar {id} class="av--xl" />
        <span>{a.name}</span>
      {/if}
    </button>
  {/each}
</div>
<div class="avpick__cap">
  {#if ui.skin === "amber"}<AppAvatar id={cur.id} />{/if}
  <b>{cur.name}</b>
  <span>{cur.tagline}</span>
</div>
