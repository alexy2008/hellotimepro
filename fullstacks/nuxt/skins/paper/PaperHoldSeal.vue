<!-- ============================================================
     长按火漆封缄：按住约 1.15 秒才提交，松手过早不算（X2：空格按住同样可用）。
     完成由定时器驱动（后台标签页里 rAF 会停），rAF 只负责画进度环。
     对外：validate / submit 两个函数由父组件给；defineExpose({ reset }) 供「再写一枚」复位。
     ============================================================ -->
<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef } from "vue";
import { clamp } from "@/lib/fmt";
import { useShake } from "@/composables/useMotion";
import PaperWax from "./PaperWax.vue";

const props = defineProps<{ submitting: boolean; validate: () => boolean; submit: () => Promise<unknown> }>();

const HOLD_MS = 1150;
const IDLE_HINT = "长按火漆，封缄";
const btn = useTemplateRef<HTMLButtonElement>("btn");
const state = ref<"" | "holding" | "done">("");
const hint = ref(IDLE_HINT);
const quick = ref(0);
const shaking = useShake(quick);
let holding = false;
let raf = 0;
let timer = 0;
let t0 = 0;

const setHp = (v: number | string) => btn.value?.style.setProperty("--hp", String(v));

function frame(t: number) {
  if (!holding) return;
  setHp(clamp((t - t0) / HOLD_MS, 0, 1).toFixed(3));
  raf = requestAnimationFrame(frame);
}

function complete() {
  if (!holding) return;
  holding = false;
  cancelAnimationFrame(raf);
  setHp(1);
  state.value = "done";
  void props.submit().then((c) => {
    if (!c) reset();
  });
}

function start() {
  if (holding || state.value === "done") return;
  if (!props.validate()) return;
  holding = true;
  t0 = performance.now();
  state.value = "holding";
  hint.value = "按住，别松手…";
  raf = requestAnimationFrame(frame);
  timer = window.setTimeout(complete, HOLD_MS);
}

function cancel() {
  if (!holding) return;
  const isQuick = performance.now() - t0 < 320;
  holding = false;
  cancelAnimationFrame(raf);
  clearTimeout(timer);
  state.value = "";
  setHp(0);
  hint.value = isQuick ? "要按住约 1 秒才会封缄" : IDLE_HINT;
  if (isQuick) quick.value++;
}

function reset() {
  state.value = "";
  hint.value = IDLE_HINT;
  setHp(0);
}

function onPointerDown(e: PointerEvent) {
  if (e.button) return;
  e.preventDefault();
  const el = e.currentTarget as HTMLButtonElement;
  el.focus({ preventScroll: true });
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* 某些浏览器在合成事件里不允许捕获 */
  }
  start();
}
function onKeyDown(e: KeyboardEvent) {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
    e.preventDefault();
    start();
  }
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key === " " || e.key === "Enter") cancel();
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearTimeout(timer);
});
defineExpose({ reset });
</script>

<template>
  <div class="hold-row">
    <button
      ref="btn"
      :class="['hold', { 'is-holding': state === 'holding', 'is-done': state === 'done', 'is-shake': shaking }]"
      type="button"
      aria-describedby="holdHint"
      data-testid="create-submit"
      @pointerdown="onPointerDown"
      @pointerup="cancel"
      @pointercancel="cancel"
      @lostpointercapture="cancel"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @blur="cancel"
      @contextmenu.prevent
    >
      <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="hold__track" cx="60" cy="60" r="56" />
        <circle class="hold__prog" cx="60" cy="60" r="56" pathLength="100" />
      </svg>
      <PaperWax ch="封" class="hold__wax" />
      <span class="sr-only">长按封缄</span>
    </button>
    <div class="hold-copy">
      <b id="holdHint">{{ submitting ? "正在封缄…" : hint }}</b>
      <p>
        封缄后不可修改、不可提前开启；
        <br />
        可以在「我创建的」里删除。
      </p>
      <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
    </div>
  </div>
</template>
