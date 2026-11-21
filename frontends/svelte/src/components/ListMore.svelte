<!-- 「我的」列表底部的「加载更多」：还有下一页时才出现（测试钩子 list-next） -->
<script lang="ts">
  let { show, busy, left, onmore }: { show: boolean; busy: boolean; left: number; onmore: () => void } = $props();
</script>

{#if show}
  <div class="list-more">
    <button class={["btn", "btn--ghost", busy && "is-busy"]} type="button" disabled={busy} data-testid="list-next" onclick={onmore}>
      {busy ? "加载中…" : `加载更多（还有 ${left} 枚）`}
    </button>
  </div>
{/if}

<style>
  /* 本前端的样式胶水：只用 base.css 刻度 */
  .list-more {
    display: flex;
    justify-content: center;
    margin-top: var(--space-8);
  }
</style>
