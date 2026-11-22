<!-- ============================================================
     翻牌倒计时：天 / 时 / 分 / 秒。每一位以「位置 + 数字」作 key，
     某一位变了就重新挂载，从而重播「落下」的动画。
     ============================================================ -->
<script setup lang="ts">
import { computed } from "vue";
import { fmt, pad2 } from "@/lib/fmt";

const props = defineProps<{ openAt: number; now: number }>();
const c = computed(() => fmt.cd(props.openAt, props.now));
const units = computed(() => [
  { k: "d", l: "天", v: String(c.value.d).padStart(2, "0") },
  { k: "h", l: "时", v: pad2(c.value.h) },
  { k: "m", l: "分", v: pad2(c.value.m) },
  { k: "s", l: "秒", v: pad2(c.value.s) },
]);
</script>

<template>
  <div class="cd" role="timer" :aria-label="`距离开启还有 ${c.d} 天 ${c.h} 小时 ${c.m} 分 ${c.s} 秒`">
    <template v-for="(u, i) in units" :key="u.k">
      <div v-if="i" class="cd__sep" aria-hidden="true">:</div>
      <div :class="['cd__unit', { 'cd__unit--accent': u.k === 's' }]">
        <div class="cd__digits">
          <span v-for="(d, j) in Array.from(u.v)" :key="`${j}-${d}`" class="cd__digit">{{ d }}</span>
        </div>
        <div class="cd__label">{{ u.l }}</div>
      </div>
    </template>
  </div>
</template>
