<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  value: number;
  label: string;
}>();

const str = computed(() => String(props.value).padStart(2, "0"));
const shown = ref(str.value);
const phase = ref<"idle" | "fold" | "unfold">("idle");

watch(str, (next, prev) => {
  if (next !== prev) {
    phase.value = "fold";
  }
});

function handleAnimationEnd() {
  if (phase.value === "fold") {
    shown.value = str.value;
    phase.value = "unfold";
  } else if (phase.value === "unfold") {
    phase.value = "idle";
  }
}
</script>

<template>
  <div class="cy-cal-unit">
    <div
      :class="['cy-cal-card', phase !== 'idle' ? `cy-cal-card--${phase}` : '']"
      @animationend="handleAnimationEnd"
    >
      <div :class="['cy-cal-num', shown.length > 2 ? 'cy-cal-num--sm' : '']">
        {{ shown }}
      </div>
      <div class="cy-cal-crease" />
    </div>
    <div class="cy-cal-label">{{ label }}</div>
  </div>
</template>
