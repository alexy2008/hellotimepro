<!-- ============================================================
     胶囊插画：全站反复出现的母题。左半是专属配色的舱盖，右半是能看见信纸的玻璃舱。
     locked 合拢上锁；opened 两半分开、信纸升起。切换形态只改 class，过渡由 CSS 完成。
     颜色由胶囊码算出（lib/palette，docs/02-design.md §9.6）
     ============================================================ -->
<script setup lang="ts">
import { computed, useId } from "vue";
import { paletteOf } from "@/lib/palette";

const props = withDefaults(defineProps<{ code: string | null; state?: "locked" | "opened"; width?: number }>(), {
  state: "locked",
  width: 200,
});
const p = computed(() => paletteOf(props.code));
const id = `ca-${useId()}`;
</script>

<template>
  <svg
    :class="['cart', `cart--${state}`]"
    :width="width"
    :height="width / 2"
    viewBox="0 0 240 120"
    :style="{ '--cap-glow': p.glow }"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="`${id}c`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="p.capLight" />
        <stop offset="1" :stop-color="p.capDeep" />
      </linearGradient>
      <linearGradient :id="`${id}g`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".62" />
        <stop offset="1" :stop-color="p.accent" stop-opacity=".42" />
      </linearGradient>
    </defs>
    <ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6" />
    <g class="cart__paper">
      <rect x="98" y="24" width="44" height="62" rx="5" />
      <path d="M106 40h28M106 50h28M106 60h17" />
    </g>
    <g class="cart__cap">
      <path d="M120 30H60a30 30 0 0 0 0 60h60Z" :fill="`url(#${id}c)`" />
      <path class="cart__groove" d="M104 31v58M111 31v58" />
      <path class="cart__shine" d="M60 41h36" />
    </g>
    <g class="cart__body">
      <path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" :fill="`url(#${id}g)`" />
      <rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6" />
      <path class="cart__scroll-line" d="M141 56h30M141 64h19" />
      <path class="cart__shine" d="M132 40h40" />
    </g>
    <rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5" />
    <circle class="cart__lock" cx="120" cy="60" r="4.5" />
  </svg>
</template>
