<!-- 日历底部的时 / 分输入：自己持有正在敲的字，失焦或回车才提交。
     v 是可写的 $derived：开启时刻变了就跟着变，敲字时就地改写 -->
<script lang="ts">
  import { pad2 } from "@/lib/fmt";

  let { which, openAt, oncommit }: { which: "h" | "m"; openAt: number; oncommit: (which: "h" | "m", raw: string) => void } = $props();

  const pick = (t: number) => {
    const d = new Date(t);
    return pad2(which === "h" ? d.getHours() : d.getMinutes());
  };
  let v = $derived(pick(openAt));

  function onkeydown(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (e.key === "Enter") oncommit(which, el.value);
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const max = which === "h" ? 24 : 60;
    const step = (e.key === "ArrowUp" ? 1 : -1) * (which === "h" ? 1 : 5);
    oncommit(which, String(((parseInt(el.value, 10) || 0) + step + max) % max));
  }
</script>

<input
  value={v}
  class="cal__t mono"
  inputmode="numeric"
  maxlength="2"
  aria-label={which === "h" ? "小时" : "分钟"}
  oninput={(e) => (v = e.currentTarget.value)}
  onblur={() => oncommit(which, v)}
  {onkeydown}
/>
