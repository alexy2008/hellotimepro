<script lang="ts">
  import type { CapsuleRecommendation } from "@/types";

  // 三组主题色，按下标轮换；文字默认色、无填充，仅用主色勾一道圆角边框做点缀（全取自设计 token）
  const PALETTES = ["brand", "accent", "signal"] as const;
  function chipBorder(index: number): string {
    return `var(--color-${PALETTES[index % PALETTES.length]}-primary)`;
  }

  let {
    recos,
    busy = false,
    disabled = false,
    onPick,
    onRefresh,
  }: {
    recos: CapsuleRecommendation[];
    busy?: boolean;
    disabled?: boolean;
    onPick: (reco: CapsuleRecommendation) => void;
    onRefresh: () => void;
  } = $props();
</script>

<div class="cy-field">
  <div style:display="flex" style:align-items="center" style:gap="var(--space-2)">
    <label style:margin="0">✨ 没有头绪？试试这些灵感</label>
    <button
      type="button"
      class="cy-btn cy-btn--ghost cy-btn--sm"
      onclick={onRefresh}
      disabled={busy || disabled}
      data-testid="reco-refresh"
      style:margin-left="auto"
    >
      {busy ? "换一批中…" : "换一批"}
    </button>
  </div>

  <div style:display="flex" style:flex-wrap="wrap" style:gap="var(--space-2)">
    {#each recos as reco, i (reco.title)}
      <button
        type="button"
        class="cy-btn cy-btn--ghost cy-btn--sm"
        onclick={() => onPick(reco)}
        disabled={busy || disabled}
        title={reco.hint}
        data-testid="reco-chip"
        style:white-space="nowrap"
        style:border="1px solid {chipBorder(i)}"
        style:border-radius="var(--radius-full)"
      >
        {reco.title}
      </button>
    {/each}
  </div>
</div>
