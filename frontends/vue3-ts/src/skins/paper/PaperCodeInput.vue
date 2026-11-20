<!-- ============================================================
     「时笺」8 格输码：8 个真实输入框（四四分组）。
     粘贴、自动填充或一次填入整码（测试里的 fill）都会分发到各格。
     size：'' 为开启页的大号，'sm' 为首页的小号。
     对外：emit change / complete；defineExpose({ set }) 供「粘贴识别」写入整码。
     ============================================================ -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { focusIfIdle } from "@/lib/fmt";
import type { CodeState } from "@/composables/useCodeOpen";

const props = withDefaults(defineProps<{ size?: "" | "sm"; state: CodeState; shake: number; autofocus?: boolean }>(), {
  size: "",
  autofocus: false,
});
const emit = defineEmits<{ change: [v: string]; complete: [v: string] }>();

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const cells = ref<string[]>(Array(8).fill(""));
/** 8 个格子的 DOM：用函数式 ref 按下标存（v-for 里的字符串 ref 不保证顺序） */
const inputs: Array<HTMLInputElement | null> = [];
const shaking = ref(false);
let timers: number[] = [];

watch(
  () => props.shake,
  (n) => {
    if (!n) return;
    shaking.value = true;
    timers.push(window.setTimeout(() => (shaking.value = false), 480));
    inputs[7]?.focus();
  },
);
onMounted(() => {
  if (props.autofocus) timers.push(window.setTimeout(() => focusIfIdle(inputs[0]), 350));
});
onBeforeUnmount(() => timers.forEach(clearTimeout));

function commit(next: string[], focusAt: number, completeNow: boolean) {
  cells.value = next;
  const v = next.join("");
  emit("change", v);
  inputs[Math.min(7, focusAt)]?.focus();
  if (completeNow && v.length === 8) emit("complete", v);
}

/** 从第 from 格开始填入一串字符 */
function fill(str: string, from: number) {
  const s = clean(str).slice(0, 8 - from);
  const next = [...cells.value];
  Array.from(s).forEach((ch, k) => (next[from + k] = ch));
  commit(next, from + s.length, true);
}

function onInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement;
  const v = clean(el.value);
  // 一次进来不止一个字符：当作从这一格开始粘贴（整码则从头填）
  if (v.length > 1) return fill(v, v.length >= 8 ? 0 : i);
  const next = [...cells.value];
  next[i] = v;
  el.value = v; // 丢掉的非法字符不留在框里
  commit(next, v && i < 7 ? i + 1 : i, i === 7 && !!v);
}

function onKey(i: number, e: KeyboardEvent) {
  if (e.key === "Backspace" && !cells.value[i] && i > 0) {
    e.preventDefault();
    const next = [...cells.value];
    next[i - 1] = "";
    commit(next, i - 1, false);
  } else if (e.key === "ArrowLeft" && i > 0) {
    e.preventDefault();
    inputs[i - 1]?.focus();
  } else if (e.key === "ArrowRight" && i < 7) {
    e.preventDefault();
    inputs[i + 1]?.focus();
  } else if (e.key === "Enter") {
    e.preventDefault();
    emit("complete", cells.value.join(""));
  }
}

function onPaste(i: number, e: ClipboardEvent) {
  e.preventDefault();
  const t = clean(e.clipboardData?.getData("text") ?? "");
  if (t) fill(t, t.length >= 8 ? 0 : i);
}

defineExpose({
  /** 外部写入整码（粘贴识别用） */
  set(v: string) {
    const s = clean(v).slice(0, 8);
    commit(Array.from({ length: 8 }, (_, k) => s[k] ?? ""), s.length, true);
  },
});
</script>

<template>
  <div
    :class="['code', size && `code--${size}`, { 'is-error': state === 'error', 'is-checking': state === 'checking', 'is-ok': state === 'ok', 'is-shake': shaking }]"
    role="group"
    aria-label="8 位胶囊码"
  >
    <template v-for="(ch, i) in cells" :key="i">
      <span v-if="i === 4" class="code__dash" aria-hidden="true" />
      <input
        :ref="(el) => (inputs[i] = el as HTMLInputElement | null)"
        :class="['code__cell', 'mono', { 'is-filled': ch }]"
        type="text"
        inputmode="text"
        :maxlength="i === 0 ? 8 : 1"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        :aria-label="`第 ${i + 1} 位`"
        :style="{ '--k': i }"
        :value="ch"
        :data-testid="i === 0 ? 'code-input' : undefined"
        data-code-cell=""
        :data-value="ch"
        @focus="($event.target as HTMLInputElement).select()"
        @input="onInput(i, $event)"
        @keydown="onKey(i, $event)"
        @paste="onPaste(i, $event)"
      />
    </template>
  </div>
</template>
