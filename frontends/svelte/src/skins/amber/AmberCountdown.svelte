<!-- ============================================================
     翻牌倒计时：天 / 时 / 分 / 秒。每一位以「位置 + 数字」作 key，
     某一位变了就重新挂载，从而重播「落下」的动画。
     ============================================================ -->
<script lang="ts">
  import { fmt, pad2 } from "@/lib/fmt";

  let { openAt, now }: { openAt: number; now: number } = $props();
  const c = $derived(fmt.cd(openAt, now));
  const units = $derived([
    { k: "d", l: "天", v: String(c.d).padStart(2, "0") },
    { k: "h", l: "时", v: pad2(c.h) },
    { k: "m", l: "分", v: pad2(c.m) },
    { k: "s", l: "秒", v: pad2(c.s) },
  ]);
</script>

<div class="cd" role="timer" aria-label={`距离开启还有 ${c.d} 天 ${c.h} 小时 ${c.m} 分 ${c.s} 秒`}>
  {#each units as u, i (u.k)}
    {#if i}<div class="cd__sep" aria-hidden="true">:</div>{/if}
    <div class={["cd__unit", u.k === "s" && "cd__unit--accent"]}>
      <div class="cd__digits">
        {#each Array.from(u.v) as d, j (`${j}-${d}`)}<span class="cd__digit">{d}</span>{/each}
      </div>
      <div class="cd__label">{u.l}</div>
    </div>
  {/each}
</div>
