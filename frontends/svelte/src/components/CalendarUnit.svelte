<script lang="ts">
  import { untrack } from "svelte";

  interface Props {
    value: number;
    label: string;
  }

  let { value, label }: Props = $props();

  const str = $derived(String(value).padStart(2, "0"));
  const isLong = $derived(str.length > 2);

  let shown = $state("");
  let phase = $state<"idle" | "fold" | "unfold">("idle");

  // 监听 str 变化：进入 fold 动画。用 untrack 读 shown 避免依赖自循环。
  $effect(() => {
    const next = str;
    if (next !== untrack(() => shown)) {
      // 首次挂载时 shown 还是空串，直接拍上去；后续才进入翻动动画
      if (untrack(() => shown) === "") {
        shown = next;
      } else {
        phase = "fold";
      }
    }
  });

  function handleAnimationEnd() {
    if (phase === "fold") {
      shown = str;
      phase = "unfold";
    } else if (phase === "unfold") {
      phase = "idle";
    }
  }
</script>

<div class={["cy-cal-unit", isLong ? "cy-cal-unit--wide" : ""].join(" ")}>
  <div
    class={[
      "cy-cal-card",
      isLong ? "cy-cal-card--wide" : "",
      phase !== "idle" ? `cy-cal-card--${phase}` : "",
    ].join(" ")}
    onanimationend={handleAnimationEnd}
  >
    <div class="cy-cal-num">{shown}</div>
    <div class="cy-cal-crease"></div>
  </div>
  <div class="cy-cal-label">{label}</div>
</div>
