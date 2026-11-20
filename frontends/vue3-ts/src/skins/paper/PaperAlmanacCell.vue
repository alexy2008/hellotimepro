<!-- 年鉴的一格：数字进入视口时数上来（年份从今年数到目标年） -->
<script setup lang="ts">
import { fmt } from "@/lib/fmt";
import { useCountUp } from "@/composables/usePlazaHome";

const props = defineProps<{ k: string; n: number; a: string; b: string; plain?: boolean }>();
const value = useCountUp(
  () => props.n,
  () => (props.plain ? new Date().getFullYear() : 0),
);
</script>

<template>
  <div class="almanac__cell" data-testid="stat" :data-key="k" :data-value="n">
    <b ref="countEl" class="latin">{{ plain ? value : fmt.num(value) }}</b>
    <span>{{ a }}<br />{{ b }}</span>
  </div>
</template>
