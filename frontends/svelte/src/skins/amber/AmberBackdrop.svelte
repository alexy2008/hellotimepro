<!-- 「琥珀」背景：光晕 + 粒子画布 + 颗粒（「时笺」下由 shell.css 隐藏）。
     画布用附件启停：附件里读了皮肤与明暗，换了就先停掉上一轮再重画；只在琥珀皮肤下绘制 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { startSky } from "./sky";
</script>

<div class="bg" aria-hidden="true">
  <div class="bg__aurora bg__aurora--a"></div>
  <div class="bg__aurora bg__aurora--b"></div>
  <div class="bg__aurora bg__aurora--c"></div>
  <canvas class="bg__canvas" {@attach (c) => (ui.skin === "amber" ? startSky(c, ui.theme !== "light") : undefined)}></canvas>
  <div class="bg__grain"></div>
</div>
