<!-- ============================================================
     时间标尺：对数刻度，从「此刻」到「十年」。拖动 / 点按 / 方向键调整启封距离，
     松手后对齐到取整后的时刻。外部（预设、日历）改了时刻时平滑滑过去（is-glide）。
     ============================================================ -->
<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { clamp, fmt, reducedMotion } from "@/lib/fmt";
import { DAY, HOUR, LIMITS, MIN } from "@/lib/schedule";

const props = defineProps<{ openAt: number; now: number }>();
const emit = defineEmits<{ pick: [t: number] }>();

const ANCHORS = [
  { ms: 2 * MIN, label: "此刻" },
  { ms: HOUR, label: "1 小时" },
  { ms: DAY, label: "1 天" },
  { ms: 7 * DAY, label: "1 周" },
  { ms: 30 * DAY, label: "1 个月" },
  { ms: 182 * DAY, label: "半年" },
  { ms: 365 * DAY, label: "1 年" },
  { ms: 1096 * DAY, label: "3 年" },
  { ms: 1826 * DAY, label: "5 年" },
  { ms: 3651 * DAY, label: "10 年" },
];
const SEGS = ANCHORS.length - 1;
const SEG_W = 124;
const STRIP_W = SEGS * SEG_W;

const TICKS: Array<{ left: number; cls: string; label?: string }> = [];
for (let i = 0; i <= SEGS; i++) {
  TICKS.push({ left: i * SEG_W, cls: "rt rt--major", label: ANCHORS[i].label });
  if (i < SEGS) for (let k = 1; k < 8; k++) TICKS.push({ left: i * SEG_W + (k * SEG_W) / 8, cls: k === 4 ? "rt rt--mid" : "rt" });
}

function vToMs(v: number) {
  const x = clamp(v, 0, 1) * SEGS;
  const i = Math.min(SEGS - 1, Math.floor(x));
  return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
}
function msToV(span: number) {
  const m = clamp(span, ANCHORS[0].ms, ANCHORS[SEGS].ms);
  for (let i = 0; i < SEGS; i++) {
    if (m <= ANCHORS[i + 1].ms) return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
  }
  return 1;
}

/** 标尺拖出来的时长，按量级取整：越远越不需要精确到分钟 */
function roundOpen(span: number) {
  const d = new Date(Date.now() + span);
  if (span < HOUR) d.setSeconds(0, 0);
  else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.getTime();
}
const clampOpen = (t: number) => clamp(t, LIMITS.minOpen() + 30_000, LIMITS.maxOpen());

const needle = useTemplateRef<HTMLElement>("needle");
const drag = ref(false);
const glide = ref(false);
/** 拖动中用拖出来的 v；松手后回到由时刻算出的位置 */
const dragV = ref<number | null>(null);
const v = computed(() => dragV.value ?? msToV(props.openAt - props.now));
const span = computed(() => props.openAt - props.now);

let lastPicked = NaN;
// 外部（预设 / 日历 / AI）改了时刻：平滑滑过去
watch(
  () => props.openAt,
  (t) => {
    if (t === lastPicked) return;
    dragV.value = null;
    glide.value = true;
  },
);

function setFromV(nv: number) {
  dragV.value = clamp(nv, 0, 1);
  glide.value = false;
  lastPicked = clampOpen(roundOpen(vToMs(dragV.value)));
  emit("pick", lastPicked);
}

let lastTick = -1;
function tickFx(nv: number) {
  const idx = Math.round(nv * SEGS * 8);
  if (idx !== lastTick && needle.value?.animate && !reducedMotion()) {
    needle.value.animate([{ transform: "translateX(-50%) scaleY(1.14)" }, { transform: "translateX(-50%) scaleY(1)" }], {
      duration: 150,
      easing: "ease-out",
    });
  }
  lastTick = idx;
}

function onPointerDown(e: PointerEvent) {
  if (e.button) return;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const x0 = e.clientX;
  const v0 = v.value;
  let moved = false;
  drag.value = true;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0;
    if (Math.abs(dx) > 3) moved = true;
    if (!moved) return;
    const nv = v0 - dx / STRIP_W;
    setFromV(nv);
    tickFx(nv);
  };
  const up = (ev: PointerEvent) => {
    drag.value = false;
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    if (!moved && ev.type === "pointerup") {
      const r = el.getBoundingClientRect();
      setFromV(v0 + (ev.clientX - (r.left + r.width / 2)) / STRIP_W);
    }
    dragV.value = null; // 松手后对齐到取整后的时刻
    glide.value = true;
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

function onKey(e: KeyboardEvent) {
  const cur = v.value;
  const step = e.shiftKey ? 0.02 : 0.004;
  let nv: number | null = null;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") nv = cur - step;
  else if (e.key === "ArrowRight" || e.key === "ArrowUp") nv = cur + step;
  else if (e.key === "PageDown") nv = (Math.ceil(cur * SEGS - 0.001) - 1) / SEGS;
  else if (e.key === "PageUp") nv = (Math.floor(cur * SEGS + 0.001) + 1) / SEGS;
  else if (e.key === "Home") nv = 0;
  else if (e.key === "End") nv = 1;
  if (nv == null) return;
  e.preventDefault();
  setFromV(nv);
  tickFx(nv);
  dragV.value = null;
}
</script>

<template>
  <div
    :class="['ruler', { 'is-drag': drag, 'is-glide': glide }]"
    tabindex="0"
    role="slider"
    aria-label="启封距离：左右拖动或用方向键调整"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="Math.round(v * 100)"
    :aria-valuetext="`${fmt.span(span)}后，${fmt.full(openAt)}`"
    @pointerdown="onPointerDown"
    @keydown="onKey"
  >
    <div class="ruler__strip" :style="{ transform: `translateX(${(-v * STRIP_W).toFixed(1)}px)` }">
      <i v-for="(t, i) in TICKS" :key="i" :class="t.cls" :style="{ left: `${t.left}px` }"><b v-if="t.label">{{ t.label }}</b></i>
    </div>
    <div ref="needle" class="ruler__needle" />
  </div>
</template>
