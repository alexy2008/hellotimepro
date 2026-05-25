<script lang="ts">
  // 通用分页器：上一页 / 当前页 X / Y / 下一页

  interface Props {
    page: number;
    totalPages: number;
    /** 可选：在「第 X / Y 页」之后追加的尾部信息，如「共 N 条」 */
    extra?: string;
    /** 总页数 ≤ 1 时是否仍渲染（默认隐藏） */
    alwaysShow?: boolean;
    /** 上下外边距 */
    margin?: string;
    onChange: (p: number) => void;
  }

  let {
    page,
    totalPages,
    extra = "",
    alwaysShow = false,
    margin = "var(--space-8) 0",
    onChange,
  }: Props = $props();
</script>

{#if alwaysShow || totalPages > 1}
  <div
    style:display="flex"
    style:justify-content="center"
    style:align-items="center"
    style:gap="var(--space-3)"
    style:margin={margin}
  >
    <button
      type="button"
      class="cy-btn cy-btn--ghost cy-btn--sm"
      disabled={page <= 1}
      onclick={() => onChange(page - 1)}
    >
      上一页
    </button>
    <span style:color="var(--color-text-muted)" style:font-size="var(--font-size-sm)">
      第 {page} / {totalPages} 页{#if extra} · {extra}{/if}
    </span>
    <button
      type="button"
      class="cy-btn cy-btn--ghost cy-btn--sm"
      disabled={page >= totalPages}
      onclick={() => onChange(page + 1)}
    >
      下一页
    </button>
  </div>
{/if}
