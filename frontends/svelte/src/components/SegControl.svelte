<!-- ============================================================
     分段选择：一排按钮 + 一块跟着选中项滑动的底（.seg__thumb）。
     泛型组件：value 的类型就是选项值的联合类型（如 PlazaSort），用 bind:value 或 onchange。
     两套皮肤同一份标记，长相由 spec/styles 决定。
     ============================================================ -->
<script lang="ts" generics="T extends string">
  import AppIcon from "@/components/AppIcon.svelte";
  import { slider } from "@/lib/attach";
  import type { SegOption } from "@/components/seg";

  let {
    value = $bindable(),
    label,
    options,
    testid,
    onchange,
  }: { value: T; label: string; options: SegOption<T>[]; testid: string; onchange?: (v: T) => void } = $props();

  const pick = (v: T) => {
    if (v === value) return;
    value = v;
    onchange?.(v);
  };
</script>

<!-- 选中项变了、数量从无到有（按钮变宽）都要重新对齐 -->
<div class="seg" role="group" aria-label={label} {@attach slider(".seg__opt.is-active", ".seg__thumb", () => [value, options.map((o) => o.count ?? "").join(",")])}>
  <span class="seg__thumb"></span>
  {#each options as o (o.value)}
    <button
      class={["seg__opt", o.value === value && "is-active"]}
      type="button"
      aria-pressed={o.value === value}
      data-testid={testid}
      data-value={o.value}
      data-selected={o.value === value}
      data-count={o.count ?? undefined}
      onclick={() => pick(o.value)}
    >
      {#if o.icon}<AppIcon name={o.icon} />{/if}{o.label}{#if o.count != null}<sup>{o.count}</sup>{/if}
    </button>
  {/each}
</div>
