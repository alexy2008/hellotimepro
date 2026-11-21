<!-- 翻页数字的一位：变化时旧数字向上退出、新数字从下方进入 -->
<script lang="ts">
  import { untrack } from "svelte";

  let { v }: { v: string } = $props();
  let prev = $state<string | null>(null);
  let old = untrack(() => v);
  let t = 0;

  $effect.pre(() => {
    const cur = v;
    untrack(() => {
      if (cur === old) return;
      prev = old;
      old = cur;
      clearTimeout(t);
      t = window.setTimeout(() => (prev = null), 520);
    });
  });
  $effect(() => () => clearTimeout(t));
</script>

<span class="dg" data-v={v}>
  {#if prev !== null}
    {#key prev}<span class="dg__out">{prev}</span>{/key}
  {/if}
  {#key v}<span class={["dg__cur", prev !== null && "dg__in"]}>{v}</span>{/key}
</span>
