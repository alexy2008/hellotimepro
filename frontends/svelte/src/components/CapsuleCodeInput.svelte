<script lang="ts">
  const LEN = 8;

  interface Props {
    value: string;
    onInput: (v: string) => void;
    onComplete?: (v: string) => void;
  }

  let { value, onInput, onComplete }: Props = $props();

  const refs: Array<HTMLInputElement | null> = $state(
    Array.from({ length: LEN }, () => null),
  );
  const chars = $derived(
    Array.from({ length: LEN }, (_, i) => (value[i] ?? "").toUpperCase()),
  );

  // 当外部 value 变成 LEN 长度时触发 complete（同一个值不重复触发）
  let lastFired = $state("");
  $effect(() => {
    const v = value;
    if (v.length === LEN && v !== lastFired) {
      lastFired = v;
      onComplete?.(v);
    }
  });

  function setAt(i: number, ch: string) {
    const sanitized = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const next = (
      chars.slice(0, i).join("") +
      sanitized +
      chars.slice(i + 1).join("")
    ).slice(0, LEN);
    onInput(next);
    if (sanitized && i < LEN - 1) {
      refs[i + 1]?.focus();
    }
  }

  function handleKey(i: number, e: KeyboardEvent) {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      refs[i + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData?.getData("text") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, LEN);
    onInput(text);
    refs[Math.min(text.length, LEN - 1)]?.focus();
  }

  function onInputEvt(i: number, e: Event) {
    const v = (e.target as HTMLInputElement).value;
    setAt(i, v.slice(-1));
  }
</script>

<div class="cy-code-input">
  {#each chars as ch, i (i)}
    <input
      bind:this={refs[i]}
      type="text"
      inputmode="text"
      autocapitalize="characters"
      maxlength="1"
      value={ch}
      aria-label={`第 ${i + 1} 位`}
      oninput={(e) => onInputEvt(i, e)}
      onkeydown={(e) => handleKey(i, e)}
      onpaste={handlePaste}
    />
  {/each}
</div>
