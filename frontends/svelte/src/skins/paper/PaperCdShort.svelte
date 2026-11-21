<!-- 卡片上的短倒计时：超过一天显示「N 天 hh:mm:ss」 -->
<script lang="ts">
  import { fmt, pad2 } from "@/lib/fmt";

  let { openAt, now }: { openAt: number; now: number } = $props();
  const c = $derived(fmt.cd(openAt, now));
  const hms = $derived(`${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`);
</script>

{#if c.d > 0}
  <b class="latin">{fmt.num(c.d)}</b>
  <small>天</small>
  <span class="mono">{hms}</span>
{:else}
  <b class="mono cap__cd-hms">{hms}</b>
{/if}
