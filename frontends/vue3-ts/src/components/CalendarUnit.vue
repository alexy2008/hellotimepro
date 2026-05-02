<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  value: number;
  label: string;
}>();

const str = computed(() => String(props.value).padStart(2, "0"));
const isLong = computed(() => str.value.length > 2);
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
  <div :class="['cy-cal-unit', isLong ? 'cy-cal-unit--wide' : '']">
    <div
      :class="['cy-cal-card', isLong ? 'cy-cal-card--wide' : '', phase !== 'idle' ? `cy-cal-card--${phase}` : '']"
      @animationend="handleAnimationEnd"
    >
      <div class="cy-cal-num">
        {{ shown }}
      </div>
      <div class="cy-cal-crease" />
    </div>
    <div class="cy-cal-label">{{ label }}</div>
  </div>
</template>
