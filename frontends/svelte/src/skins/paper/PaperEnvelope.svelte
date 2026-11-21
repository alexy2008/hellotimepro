<!-- ============================================================
     信封（封口面）：back 内衬 → letter 信纸 → front 口袋 → flap 封舌 → seal 火漆
     crack：火漆的状态。split 先换成左右两半，cracked 再让两半裂开（分两步，过渡才会生效）
     信纸上写什么由 children 片段决定
     ============================================================ -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import PaperWax from "./PaperWax.svelte";

  let {
    seal = true,
    crack = "whole",
    class: cls = "",
    children,
  }: { seal?: boolean; crack?: "whole" | "split" | "cracked"; class?: string; children?: Snippet } = $props();
</script>

<div class={["env", cls]}>
  <div class="env__back"></div>
  <div class="env__letter">{@render children?.()}</div>
  <div class="env__front">
    <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
      <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z" />
      <path class="env__shade" d="M1 2.2 50 38 99 2.2" />
      <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9" />
      <path class="env__edge" d="M0 0 50 36 100 0" />
    </svg>
  </div>
  <div class="env__flap">
    <i class="env__flap-f">
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0" /></svg>
    </i>
    <i class="env__flap-b"></i>
  </div>
  {#if seal}
    <div class={["env__seal", crack === "cracked" && "is-cracked"]}>
      {#if crack === "whole"}
        <PaperWax />
      {:else}
        <span class="wax-half wax-half--l"><PaperWax /></span>
        <span class="wax-half wax-half--r"><PaperWax /></span>
      {/if}
    </div>
  {/if}
</div>
