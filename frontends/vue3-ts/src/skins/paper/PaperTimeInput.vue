<!-- 日历底部的时 / 分输入：自己持有正在敲的字，失焦或回车才提交（父组件每秒重绘也不会丢焦点） -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { pad2 } from "@/lib/fmt";

const props = defineProps<{ which: "h" | "m"; openAt: number }>();
const emit = defineEmits<{ commit: [which: "h" | "m", raw: string] }>();

const pick = (t: number) => {
  const d = new Date(t);
  return pad2(props.which === "h" ? d.getHours() : d.getMinutes());
};
const v = ref(pick(props.openAt));
watch(() => [props.openAt, props.which], () => (v.value = pick(props.openAt)));

function onKey(e: KeyboardEvent) {
  const el = e.currentTarget as HTMLInputElement;
  if (e.key === "Enter") emit("commit", props.which, el.value);
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  const max = props.which === "h" ? 24 : 60;
  const step = (e.key === "ArrowUp" ? 1 : -1) * (props.which === "h" ? 1 : 5);
  emit("commit", props.which, String(((parseInt(el.value, 10) || 0) + step + max) % max));
}
</script>

<template>
  <input
    v-model="v"
    class="cal__t mono"
    inputmode="numeric"
    maxlength="2"
    :aria-label="which === 'h' ? '小时' : '分钟'"
    @blur="emit('commit', which, v)"
    @keydown="onKey"
  />
</template>
