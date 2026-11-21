<!-- ============================================================
     「时笺」8 格输码：8 个真实输入框（四四分组）。
     粘贴、自动填充或一次填入整码（测试里的 fill）都会分发到各格。
     size：'' 为开启页的大号，'sm' 为首页的小号。
     格子从路由的 value 派生，保留中间空位；改动经 onchange / oncomplete 交给路由。
     导出 set()：父组件 bind:this 后供「粘贴识别」写入整码。
     ============================================================ -->
<script lang="ts">
  import { untrack } from "svelte";
  import { focusIfIdle } from "@/lib/fmt";
  import { EMPTY_CODE_CELL, isCompleteCode, type CodeState } from "@/state/code-open.svelte.ts";

  interface Props {
    value: string;
    size?: "" | "sm";
    state: CodeState;
    shake: number;
    autofocus?: boolean;
    id?: string;
    onchange: (v: string) => void;
    oncomplete: (v: string) => void;
  }
  let { value, size = "", state: codeState, shake, autofocus = false, id, onchange, oncomplete }: Props = $props();

  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cells = $derived(Array.from({ length: 8 }, (_, i) => {
    const ch = value[i];
    return ch === EMPTY_CODE_CELL ? "" : ch ?? "";
  }));
  const inputs: Array<HTMLInputElement | null> = $state([]);
  let shaking = $state(false);
  const timers: number[] = [];

  // 出错次数加一：抖一下，焦点放回最后一格（挂载时的旧值不算）
  let lastShake = untrack(() => shake);
  $effect(() => {
    if (shake === lastShake) return;
    lastShake = shake;
    if (!shake) return;
    shaking = true;
    timers.push(window.setTimeout(() => (shaking = false), 480));
    untrack(() => inputs[7])?.focus();
  });
  $effect(() => {
    if (untrack(() => autofocus)) timers.push(window.setTimeout(() => focusIfIdle(inputs[0]), 350));
    return () => timers.forEach(clearTimeout);
  });

  function commit(next: string[], focusAt: number, completeNow: boolean) {
    const v = next.map((ch) => ch || EMPTY_CODE_CELL).join("").trimEnd();
    onchange(v);
    inputs[Math.min(7, focusAt)]?.focus();
    if (completeNow && isCompleteCode(v)) oncomplete(v);
  }

  /** 从第 from 格开始填入一串字符 */
  function fill(str: string, from: number) {
    const s = clean(str).slice(0, 8 - from);
    const next = [...cells];
    Array.from(s).forEach((ch, k) => (next[from + k] = ch));
    commit(next, from + s.length, true);
  }

  function oninput(i: number, e: Event) {
    const el = e.target as HTMLInputElement;
    const v = clean(el.value);
    // 一次进来不止一个字符：当作从这一格开始粘贴（整码则从头填）
    if (v.length > 1) return fill(v, v.length >= 8 ? 0 : i);
    const next = [...cells];
    next[i] = v;
    el.value = v; // 丢掉的非法字符不留在框里
    commit(next, v && i < 7 ? i + 1 : i, !!v);
  }

  function onkeydown(i: number, e: KeyboardEvent) {
    if (e.key === "Backspace" && !cells[i] && i > 0) {
      e.preventDefault();
      const next = [...cells];
      next[i - 1] = "";
      commit(next, i - 1, false);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      inputs[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 7) {
      e.preventDefault();
      inputs[i + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      oncomplete(value);
    }
  }

  function onpaste(i: number, e: ClipboardEvent) {
    e.preventDefault();
    const t = clean(e.clipboardData?.getData("text") ?? "");
    if (t) fill(t, t.length >= 8 ? 0 : i);
  }

  /** 外部写入整码（粘贴识别用） */
  export function set(v: string) {
    const s = clean(v).slice(0, 8);
    commit(Array.from({ length: 8 }, (_, k) => s[k] ?? ""), s.length, true);
  }
</script>

<div
  {id}
  class={["code", size && `code--${size}`, { "is-error": codeState === "error", "is-checking": codeState === "checking", "is-ok": codeState === "ok", "is-shake": shaking }]}
  role="group"
  aria-label="8 位胶囊码"
>
  {#each cells as ch, i (i)}
    {#if i === 4}<span class="code__dash" aria-hidden="true"></span>{/if}
    <input
      bind:this={inputs[i]}
      class={["code__cell", "mono", ch && "is-filled"]}
      type="text"
      inputmode="text"
      maxlength={i === 0 ? 8 : 1}
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      aria-label={`第 ${i + 1} 位`}
      style:--k={i}
      value={ch}
      data-testid={i === 0 ? "code-input" : undefined}
      data-code-cell=""
      data-value={ch}
      onfocus={(e) => e.currentTarget.select()}
      oninput={(e) => oninput(i, e)}
      onkeydown={(e) => onkeydown(i, e)}
      onpaste={(e) => onpaste(i, e)}
    />
  {/each}
</div>
