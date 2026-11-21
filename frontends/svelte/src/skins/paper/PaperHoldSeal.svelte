<!-- ============================================================
     长按火漆封缄：按住约 1.15 秒才提交，松手过早不算（X2：空格按住同样可用）。
     完成由定时器驱动（后台标签页里 rAF 会停），rAF 只负责画进度环。
     validate / submit 由父组件给；导出 reset() 供「再写一枚」复位。
     ============================================================ -->
<script lang="ts">
  import { clamp } from "@/lib/fmt";
  import { useShake } from "@/lib/motion.svelte.ts";
  import PaperWax from "./PaperWax.svelte";

  let { submitting, validate, submit }: { submitting: boolean; validate: () => boolean; submit: () => Promise<unknown> } = $props();

  const HOLD_MS = 1150;
  const IDLE_HINT = "长按火漆，封缄";
  let btn = $state<HTMLButtonElement>();
  let phase = $state<"" | "holding" | "done">("");
  let hint = $state(IDLE_HINT);
  let quick = $state(0);
  const shake = useShake(() => quick);
  let holding = false;
  let raf = 0;
  let timer = 0;
  let t0 = 0;

  const setHp = (v: number | string) => btn?.style.setProperty("--hp", String(v));

  function frame(t: number) {
    if (!holding) return;
    setHp(clamp((t - t0) / HOLD_MS, 0, 1).toFixed(3));
    raf = requestAnimationFrame(frame);
  }

  function complete() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    setHp(1);
    phase = "done";
    void submit().then((c) => {
      if (!c) reset();
    });
  }

  function start() {
    if (holding || phase === "done") return;
    if (!validate()) return;
    holding = true;
    t0 = performance.now();
    phase = "holding";
    hint = "按住，别松手…";
    raf = requestAnimationFrame(frame);
    timer = window.setTimeout(complete, HOLD_MS);
  }

  function cancel() {
    if (!holding) return;
    const isQuick = performance.now() - t0 < 320;
    holding = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    phase = "";
    setHp(0);
    hint = isQuick ? "要按住约 1 秒才会封缄" : IDLE_HINT;
    if (isQuick) quick++;
  }

  export function reset() {
    phase = "";
    hint = IDLE_HINT;
    setHp(0);
  }

  function onpointerdown(e: PointerEvent) {
    if (e.button) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLButtonElement;
    el.focus({ preventScroll: true });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* 某些浏览器在合成事件里不允许捕获 */
    }
    start();
  }
  function onkeydown(e: KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      start();
    }
  }
  function onkeyup(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") cancel();
  }

  $effect(() => () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  });
</script>

<div class="hold-row">
  <button
    bind:this={btn}
    class={["hold", { "is-holding": phase === "holding", "is-done": phase === "done", "is-shake": shake.on }]}
    type="button"
    aria-describedby="holdHint"
    data-testid="create-submit"
    {onpointerdown}
    onpointerup={cancel}
    onpointercancel={cancel}
    onlostpointercapture={cancel}
    {onkeydown}
    {onkeyup}
    onblur={cancel}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="hold__track" cx="60" cy="60" r="56" />
      <circle class="hold__prog" cx="60" cy="60" r="56" pathLength="100" />
    </svg>
    <PaperWax ch="封" class="hold__wax" />
    <span class="sr-only">长按封缄</span>
  </button>
  <div class="hold-copy">
    <b id="holdHint">{submitting ? "正在封缄…" : hint}</b>
    <p>
      封缄后不可修改、不可提前开启；
      <br />
      可以在「我创建的」里删除。
    </p>
    <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
  </div>
</div>
