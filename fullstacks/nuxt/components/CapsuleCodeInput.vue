<script setup lang="ts">
import { computed, ref, watch } from "vue";

const LEN = 8;

const props = defineProps<{
  modelValue: string;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "complete", v: string): void;
}>();

const refs = ref<Array<HTMLInputElement | null>>([]);
const chars = computed(() =>
  Array.from({ length: LEN }, (_, i) =>
    (props.modelValue[i] ?? "").toUpperCase(),
  ),
);

watch(
  () => props.modelValue,
  (v) => {
    if (v.length === LEN) emit("complete", v);
  },
);

function setAt(i: number, ch: string) {
  const sanitized = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const arr = chars.value;
  const next = (
    arr.slice(0, i).join("") + sanitized + arr.slice(i + 1).join("")
  ).slice(0, LEN);
  emit("update:modelValue", next);
  if (sanitized && i < LEN - 1) {
    refs.value[i + 1]?.focus();
  }
}

function handleKey(i: number, e: KeyboardEvent) {
  if (e.key === "Backspace" && !chars.value[i] && i > 0) {
    refs.value[i - 1]?.focus();
  } else if (e.key === "ArrowLeft" && i > 0) {
    refs.value[i - 1]?.focus();
  } else if (e.key === "ArrowRight" && i < LEN - 1) {
    refs.value[i + 1]?.focus();
  }
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = (e.clipboardData?.getData("text") ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, LEN);
  emit("update:modelValue", text);
  refs.value[Math.min(text.length, LEN - 1)]?.focus();
}

function setRef(el: Element | { $el?: Element } | null, i: number) {
  refs.value[i] = (el as HTMLInputElement) ?? null;
}

function onInput(i: number, e: Event) {
  const v = (e.target as HTMLInputElement).value;
  setAt(i, v.slice(-1));
}
</script>

<template>
  <div class="cy-code-input">
    <input
      v-for="(ch, i) in chars"
      :key="i"
      :ref="(el) => setRef(el, i)"
      type="text"
      inputmode="text"
      autocapitalize="characters"
      :maxlength="1"
      :value="ch"
      :aria-label="`第 ${i + 1} 位`"
      @input="onInput(i, $event)"
      @keydown="handleKey(i, $event)"
      @paste="handlePaste"
    />
  </div>
</template>
