<!-- ============================================================
     「琥珀」8 格输码：8 个展示格 + 一个盖在上面的透明原生输入框
     （键盘、粘贴、输入法都交给它）。size：'md' 首页 / 'lg' 开启页。
     对外：emit change / complete。
     ============================================================ -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { focusIfIdle } from "@/lib/fmt";
import type { CodeState } from "@/composables/useCodeOpen";

const props = withDefaults(defineProps<{ value: string; size?: "" | "md" | "lg"; state: CodeState; shake: number; autofocus?: boolean }>(), {
  size: "",
  autofocus: false,
});
const emit = defineEmits<{ change: [v: string]; complete: [v: string] }>();

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const focused = ref(false);
const shaking = ref(false);
/** 本次新敲进来的格子「弹」一下：从第几格开始弹 */
const popFrom = ref(8);
const input = useTemplateRef<HTMLInputElement>("input");
const timers: number[] = [];

watch(
  () => props.shake,
  (n) => {
    if (!n) return;
    shaking.value = true;
    timers.push(window.setTimeout(() => (shaking.value = false), 480));
  },
);
onMounted(() => {
  if (props.autofocus) timers.push(window.setTimeout(() => focusIfIdle(input.value), 350));
});
onBeforeUnmount(() => timers.forEach(clearTimeout));

function update(raw: string, complete: boolean) {
  const v = clean(raw);
  popFrom.value = v.length > props.value.length ? props.value.length : 8;
  if (input.value && input.value.value !== v) input.value.value = v;
  emit("change", v);
  if (complete && v.length === 8) emit("complete", v);
}

function onInput(e: Event) {
  if ((e as InputEvent).isComposing) return;
  update((e.target as HTMLInputElement).value, true);
}
function onFocus(e: FocusEvent) {
  focused.value = true;
  const el = e.target as HTMLInputElement;
  const n = el.value.length;
  el.setSelectionRange(n, n);
}
</script>

<template>
  <div
    :class="[
      'code',
      size && `code--${size}`,
      { 'is-focused': focused, 'is-error': state === 'error', 'is-checking': state === 'checking', 'is-ok': state === 'ok', 'is-shake': shaking },
    ]"
  >
    <input
      ref="input"
      class="code__native"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      maxlength="12"
      aria-label="8 位胶囊码"
      data-testid="code-input"
      :value="value"
      @input="onInput"
      @compositionend="update(($event.target as HTMLInputElement).value, false)"
      @keydown.enter.prevent="emit('complete', value)"
      @focus="onFocus"
      @blur="focused = false"
    />
    <div class="code__cells" aria-hidden="true">
      <span
        v-for="i in 8"
        :key="i"
        :class="[
          'code__cell',
          {
            'has-gap': i - 1 === 4,
            'is-filled': value[i - 1],
            'is-pop': value[i - 1] && i - 1 >= popFrom,
            'is-active': i - 1 === Math.min(value.length, 7),
          },
        ]"
        data-code-cell=""
        :data-value="value[i - 1] ?? ''"
      >
        {{ value[i - 1] ?? "" }}
      </span>
    </div>
  </div>
</template>
