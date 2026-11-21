<!-- 日历：精确到分钟。选中的那天被朱笔圈出（换了日子时重画一遍） -->
<script lang="ts">
  import { clamp, fmt } from "@/lib/fmt";
  import { LIMITS } from "@/lib/schedule";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperTimeInput from "./PaperTimeInput.svelte";

  let { openAt, onpick }: { openAt: number; onpick: (t: number) => void } = $props();

  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const sel = $derived(new Date(openAt));
  /** 正在看的月份。可写的 $derived：外部（预设 / 标尺）改了日子就翻到那个月，翻页按钮就地改写 */
  let month = $derived(new Date(sel.getFullYear(), sel.getMonth(), 1));

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
  const y = $derived(month.getFullYear());
  const mo = $derived(month.getMonth());
  const lo = (() => {
    const d = new Date(LIMITS.minOpen() + 30_000);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const hi = (() => {
    const d = new Date(LIMITS.maxOpen());
    d.setHours(23, 59, 59, 999);
    return d;
  })();
  const days = $derived.by(() => {
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const today = new Date();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, mo, 1 - lead + i);
      return { d, out: d.getMonth() !== mo, dis: d < lo || d > hi, today: sameDay(d, today), sel: sameDay(d, sel) };
    });
  });
  const selKey = $derived(`${sel.getFullYear()}-${sel.getMonth()}-${sel.getDate()}`);

  const nav = (n: number) => (month = new Date(y, mo + n, 1));

  function pickDay(d: Date) {
    const cur = new Date(openAt);
    const t = new Date(d);
    t.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
    onpick(t.getTime());
  }
  function commitTime(which: "h" | "m", raw: string) {
    const cur = new Date(openAt);
    const n = clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
    if (which === "h") cur.setHours(n);
    else cur.setMinutes(n);
    onpick(cur.getTime());
  }
</script>

<div class="cal">
  <div class="cal__head">
    <button class="cal__nav" type="button" aria-label="上一年" disabled={new Date(y - 1, mo + 1, 0) < lo} onclick={() => nav(-12)}>«</button>
    <button class="cal__nav" type="button" aria-label="上个月" disabled={new Date(y, mo, 0) < lo} onclick={() => nav(-1)}>‹</button>
    <div class="cal__title serif"><b class="latin">{y}</b> 年 <b class="latin">{mo + 1}</b> 月</div>
    <button class="cal__nav" type="button" aria-label="下个月" disabled={new Date(y, mo + 1, 1) > hi} onclick={() => nav(1)}>›</button>
    <button class="cal__nav" type="button" aria-label="下一年" disabled={new Date(y + 1, mo, 1) > hi} onclick={() => nav(12)}>»</button>
  </div>
  <div class="cal__dow">
    {#each ["一", "二", "三", "四", "五", "六", "日"] as w (w)}<span>{w}</span>{/each}
  </div>
  <div class="cal__grid">
    {#each days as it, i (i)}
      <button
        type="button"
        class={["cal__d", { "is-out": it.out, "is-today": it.today, "is-sel": it.sel }]}
        disabled={it.dis}
        aria-label={fmt.cn(it.d.getTime())}
        aria-current={it.sel ? "date" : undefined}
        onclick={() => pickDay(it.d)}
      >
        {it.d.getDate()}
        {#if it.sel}
          {#key selKey}
            <svg class="cal__ring is-draw" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6" />
            </svg>
          {/key}
        {/if}
      </button>
    {/each}
  </div>
  <div class="cal__time">
    <span class="cal__time-k"><AppIcon name="clock" />时刻</span>
    <PaperTimeInput which="h" {openAt} oncommit={commitTime} />
    <i>:</i>
    <PaperTimeInput which="m" {openAt} oncommit={commitTime} />
    <span class="cal__tz mono">{tz}</span>
  </div>
</div>
