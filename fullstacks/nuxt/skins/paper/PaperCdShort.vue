<!-- 卡片上的短倒计时：超过一天显示「N 天 hh:mm:ss」 -->
<script setup lang="ts">
import { computed } from "vue";
import { fmt, pad2 } from "@/lib/fmt";

const props = defineProps<{ openAt: number; now: number }>();
const c = computed(() => fmt.cd(props.openAt, props.now));
const hms = computed(() => `${pad2(c.value.h)}:${pad2(c.value.m)}:${pad2(c.value.s)}`);
</script>

<template>
  <template v-if="c.d > 0">
    <b class="latin">{{ fmt.num(c.d) }}</b>
    <small>天</small>
    <span class="mono">{{ hms }}</span>
  </template>
  <b v-else class="mono cap__cd-hms">{{ hms }}</b>
</template>
