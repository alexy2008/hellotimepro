<!-- ============================================================
     「琥珀」8 格输码：8 个展示格 + 一个盖在上面的透明原生输入框
     （键盘、粘贴、输入法都交给它）。size：'md' 首页 / 'lg' 开启页。
     显示的是路由输码状态里的 value，所以换皮肤后接着显示已输入的码。
     ============================================================ -->
<script lang="ts">
  import { untrack } from "svelte";
  import { focusIfIdle } from "@/lib/fmt";
  import { EMPTY_CODE_CELL, isCompleteCode, type CodeState } from "@/state/code-open.svelte.ts";

  interface Props {
    value: string;
    size?: "" | "md" | "lg";
    state: CodeState;
    shake: number;
    autofocus?: boolean;
    onchange: (v: string) => void;
    oncomplete: (v: string) => void;
  }
  let { value, size = "", state: codeState, shake, autofocus = false, onchange, oncomplete }: Props = $props();

  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const cells = $derived(Array.from({ length: 8 }, (_, i) => {
    const ch = value[i];
    return ch === EMPTY_CODE_CELL ? "" : ch ?? "";
  }));
  let focused = $state(false);
  let shaking = $state(false);
  /** 本次新敲进来的格子「弹」一下：从第几格开始弹 */
  let popFrom = $state(8);
  let input = $state<HTMLInputElement>();
  const timers: number[] = [];

  // 出错次数加一：抖一下（挂载时的旧值不算）
  let lastShake = untrack(() => shake);
  $effect(() => {
    if (shake === lastShake) return;
    lastShake = shake;
    if (!shake) return;
    shaking = true;
    timers.push(window.setTimeout(() => (shaking = false), 480));
  });
  $effect(() => {
    if (untrack(() => autofocus)) timers.push(window.setTimeout(() => focusIfIdle(input), 350));
    return () => timers.forEach(clearTimeout);
  });

  function update(raw: string) {
    const v = raw.toUpperCase().replace(/[^A-Z0-9\u00a0]/g, "").slice(0, 8).trimEnd();
    popFrom = v.length > value.length ? value.length : 8;
    if (input && input.value !== v) input.value = v;
    onchange(v);
    if (isCompleteCode(v)) oncomplete(v);
  }

  function oninput(e: Event) {
    const ev = e as InputEvent;
    if (ev.isComposing) return;
    // 一次进来一整串码（粘贴、自动填充）：与时笺一样整码从头填，不接在已经输入的几位后面
    const chunk = clean(ev.data ?? "");
    update(chunk.length === 8 ? chunk : (e.target as HTMLInputElement).value);
  }
  function onpaste(e: ClipboardEvent) {
    const code = clean(e.clipboardData?.getData("text") ?? "");
    if (!isCompleteCode(code)) return;
    e.preventDefault();
    update(code);
  }
  function onfocus(e: FocusEvent) {
    focused = true;
    const el = e.target as HTMLInputElement;
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    oncomplete(value);
  }
</script>

<div
  class={[
    "code",
    size && `code--${size}`,
    { "is-focused": focused, "is-error": codeState === "error", "is-checking": codeState === "checking", "is-ok": codeState === "ok", "is-shake": shaking },
  ]}
>
  <input
    bind:this={input}
    class="code__native"
    type="text"
    inputmode="text"
    autocomplete="off"
    autocapitalize="characters"
    spellcheck="false"
    maxlength="12"
    aria-label="8 位胶囊码"
    data-testid="code-input"
    {value}
    {oninput}
    {onpaste}
    oncompositionend={(e) => update(e.currentTarget.value)}
    {onkeydown}
    {onfocus}
    onblur={() => (focused = false)}
  />
  <div class="code__cells" aria-hidden="true">
    {#each cells as ch, i (i)}
      <span
        class={["code__cell", { "has-gap": i === 4, "is-filled": ch, "is-pop": ch && i >= popFrom, "is-active": i === Math.min(value.length, 7) }]}
        data-code-cell=""
        data-value={ch}
      >
        {ch}
      </span>
    {/each}
  </div>
</div>
