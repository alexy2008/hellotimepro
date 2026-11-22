<!-- ============================================================
     「琥珀」开启时间选择器：星轨时钟
     结构、类名与交互照 2.0 原型 assets/js/amber/datetime.js（样式在 spec/styles/amber/components.css），
     行为与 React 版 skins/amber/DateTimePicker.tsx 逐项对齐：
     - 触发条与输入框等宽；面板接在下方展开（不是浮层，不会被卡片裁掉），展开时滚进视口
     - 十年星轨：点年份穿越；拖动胶囊只换日子，时刻保留
     - 日历：方向键逐日 / 逐周；今天到选中日之间画「旅程线」
     - 昼夜表盘：先拖时针，松手切分针；分针越过 12 点进退一小时；指针角度累加不取模
     - 面板里的每次改动都夹进 LIMITS 的上下限再通知页面；外部（预设、AI 代笔、草稿恢复）改 value 时只同步显示
     时间以 value（毫秒）为唯一数据源；组件自己只管展开、月份视图、表盘模式这类界面状态。
     ============================================================ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { clamp, pad2, reducedMotion } from "@/lib/fmt";
import { LIMITS } from "@/lib/schedule";
import { useNow } from "@/composables/useNow";
import AppIcon from "@/components/AppIcon.vue";

const props = defineProps<{
  /** 当前开启时间（毫秒） */
  value: number;
}>();
const emit = defineEmits<{
  /** 用户在面板里改动：已夹进上下限 */
  change: [t: number];
}>();

const MIN = 60000;
const DAY = 86400000;
const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DOW = ["一", "二", "三", "四", "五", "六", "日"];
const NODE_IDX = Array.from({ length: 11 }, (_, i) => i);

const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** 换到另一年 / 另一个月时，日子超出当月天数就落在月末（2 月 29 日 → 2 月 28 日） */
const moveTo = (ms: number, y: number, m: number) => {
  const d = new Date(ms);
  const day = d.getDate();
  d.setDate(1);
  d.setFullYear(y, m);
  d.setDate(Math.min(day, dim(y, m)));
  return d.getTime();
};
const addYears = (ms: number, n: number) => {
  const d = new Date(ms);
  return moveTo(ms, d.getFullYear() + n, d.getMonth());
};
const addMonths = (ms: number, n: number) => {
  const d = new Date(ms);
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return moveTo(ms, t.getFullYear(), t.getMonth());
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const monthOf = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

function rel(t: number, now: number) {
  const ms = t - now;
  if (ms < 3600000) return `${Math.max(1, Math.round(ms / MIN))} 分钟后`;
  if (ms < DAY) return `${Math.round(ms / 3600000)} 小时后`;
  if (ms < 45 * DAY) return `${Math.round(ms / DAY)} 天后`;
  if (ms < 330 * DAY) return `约 ${Math.round(ms / (30.44 * DAY))} 个月后`;
  return `约 ${Math.round(ms / (365.25 * DAY))} 年后`;
}

/** 精确倒计时：按日历年、月逐级扣，剩下的换算成天 / 时 / 分；四舍五入到分钟 */
function eta(t: number, now: number): { n: number; u: string }[] {
  t += 30000;
  let cur = now;
  let y = 0;
  let mo = 0;
  while (addYears(cur, 1) <= t) {
    cur = addYears(cur, 1);
    y++;
  }
  while (addMonths(cur, 1) <= t) {
    cur = addMonths(cur, 1);
    mo++;
  }
  let ms = Math.max(0, t - cur);
  const d = Math.floor(ms / DAY);
  ms -= d * DAY;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / MIN);
  const parts: { n: number; u: string }[] = [];
  if (y) parts.push({ n: y, u: "年" });
  if (mo) parts.push({ n: mo, u: "个月" });
  if (d) parts.push({ n: d, u: "天" });
  parts.push({ n: h, u: "小时" }, { n: m, u: "分" });
  return parts;
}

/** 角度累加：59→0 时指针向前走一格，而不是倒转一整圈 */
const unwrap = (prev: number | null, next: number) => (prev == null ? next : prev + ((((next - prev) % 360) + 540) % 360) - 180);

// ---------------------------------------------------------------- 表盘的固定部分

const f2 = (n: number) => n.toFixed(2);
const DIAL_TICKS: { i: number; five: boolean; x1: string; y1: string; x2: string; y2: string }[] = [];
// 刻度圈：0 点琥珀三角，10/20…50 数字，其余每 5 分一道短条，前 15 分钟逐分细刻
const DIAL_BEZEL: { i: number; kind: "lume" | "num" | "bar" | "bar-s" | "dot"; rot: string }[] = [];
for (let i = 0; i < 60; i++) {
  const a = (i * 6 * Math.PI) / 180;
  const five = i % 5 === 0;
  const r1 = five ? 92 : 96;
  DIAL_TICKS.push({ i, five, x1: f2(110 + r1 * Math.sin(a)), y1: f2(110 - r1 * Math.cos(a)), x2: f2(110 + 100 * Math.sin(a)), y2: f2(110 - 100 * Math.cos(a)) });
  const rot = `rotate(${i * 6} 110 110)`;
  const kind = i === 0 ? "lume" : i % 10 === 0 ? "num" : five ? "bar" : i < 15 ? "bar-s" : "dot";
  DIAL_BEZEL.push({ i, kind, rot });
}
const DIAL_NUMS: { h: number; q: boolean; x: string; y: string }[] = [];
for (let h = 1; h <= 12; h++) {
  if (h === 3) continue; // 3 点位让给日历窗
  const a = (h * 30 * Math.PI) / 180;
  DIAL_NUMS.push({ h, q: h % 3 === 0, x: f2(110 + 78 * Math.sin(a)), y: f2(110 - 78 * Math.cos(a)) });
}

// ---------------------------------------------------------------- 状态

/** 每秒一跳：触发条的相对时间、倒计时、星轨位置都跟着走；模板就地打补丁，不会丢焦点与拖动状态 */
const now = useNow();

const open = ref(false);
const mode = ref<"h" | "m">("h");
const view = ref(monthOf(props.value));
const clamped = ref(false);
const railDragging = ref(false);
const dialDragging = ref(false);

const rootEl = useTemplateRef<HTMLDivElement>("rootEl");
const triggerEl = useTemplateRef<HTMLButtonElement>("triggerEl");
const railEl = useTemplateRef<HTMLDivElement>("railEl");
const gridEl = useTemplateRef<HTMLDivElement>("gridEl");
const dialEl = useTemplateRef<SVGSVGElement>("dialEl");

// 拖动是跨事件的状态，不需要触发重绘
let railDrag = false;
let dialDrag = false;
// 最新的时刻：同一帧里连来的 pointermove 不会读到还没回流的旧值
let cur = props.value;
// 面板自己刚发出的值：回流到 value 时不当作「外部改动」
let emitted: number | null = null;
// 指针角度累加（不取模），外部改值也要跟着走
const angH = ref(0);
const angM = ref(0);
let angInit = false;

watch(
  () => props.value,
  (v) => {
    cur = v;
    const d = new Date(v);
    angH.value = angInit ? unwrap(angH.value, ((d.getHours() % 12) + d.getMinutes() / 60) * 30) : ((d.getHours() % 12) + d.getMinutes() / 60) * 30;
    angM.value = angInit ? unwrap(angM.value, d.getMinutes() * 6) : d.getMinutes() * 6;
    angInit = true;
    // 外部（预设、AI 代笔、草稿恢复）改了时间：只同步月份视图与贴边提示，不回调
    if (emitted === v) {
      emitted = null;
      return;
    }
    emitted = null;
    view.value = monthOf(v);
    clamped.value = false;
  },
  { immediate: true },
);

/** 用户在面板里改动：夹进上下限 → 通知页面 */
function pick(t: number, keepView = false) {
  const c = clamp(t, LIMITS.minOpen(), LIMITS.maxOpen());
  clamped.value = c !== t;
  emitted = c;
  cur = c;
  if (!keepView) view.value = monthOf(c);
  emit("change", c);
}

// ---------------------------------------------------------------- 开合：点触发条切换；「就这一刻」、Esc、点到组件与预设之外都收起

function setOpen(o: boolean) {
  open.value = o;
  if (!o) mode.value = "h";
  else void nextTick(() => requestAnimationFrame(reveal));
}
/** 展开时把整块面板滚进视口：和展开动画同时进行；
 *  向上滚的距离以「触发条不被顶部导航挡住」为限，底部避开手机底栏 */
function reveal() {
  const el = rootEl.value;
  const trig = el?.querySelector<HTMLElement>(".dtp__trigger");
  const inner = el?.querySelector<HTMLElement>(".dtp__in");
  if (!trig || !inner) return;
  const top = trig.getBoundingClientRect().top;
  const need = top + trig.offsetHeight + inner.offsetHeight;
  const bar = document.querySelector<HTMLElement>(".tabbar");
  const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
  const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
  const over = need - (window.innerHeight - barH - 16);
  const dy = Math.min(over, top - headH - 16);
  if (dy > 0) window.scrollBy({ top: dy, behavior: reducedMotion() ? "auto" : "smooth" });
}
function outside(e: PointerEvent) {
  const t = e.target as Element | null;
  if (rootEl.value && t && !rootEl.value.contains(t) && !t.closest("[data-preset]")) setOpen(false);
}
// 展开时才挂 document 监听，收起或组件卸载时清掉
watch(open, (o) => (o ? document.addEventListener("pointerdown", outside) : document.removeEventListener("pointerdown", outside)));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));

function closeAndFocus() {
  setOpen(false);
  triggerEl.value?.focus({ preventScroll: true });
}
function onRootKey(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.stopPropagation();
    closeAndFocus();
  }
}

// ---------------------------------------------------------------- 十年星轨

const maxOpen = computed(() => (now.value, LIMITS.maxOpen()));
const f = computed(() => clamp((props.value - now.value) / (maxOpen.value - now.value), 0, 1));

function railTime(x: number) {
  const r = railEl.value!.getBoundingClientRect();
  const c = new Date(cur);
  const d = new Date(Date.now() + clamp((x - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - Date.now()));
  d.setHours(c.getHours(), c.getMinutes(), 0, 0); // 只换日子，时刻保留
  return d.getTime();
}
function onRailDown(e: PointerEvent) {
  if ((e.target as Element).closest(".orbit__node")) return;
  railDrag = true;
  railDragging.value = true;
  try {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  } catch {
    /* 合成事件没有活动指针 */
  }
  pick(railTime(e.clientX));
}
function onRailMove(e: PointerEvent) {
  if (railDrag) pick(railTime(e.clientX));
}
function endRail() {
  railDrag = false;
  railDragging.value = false;
}
function onCapKey(e: KeyboardEvent) {
  const n = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
  const y = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
  if (!n && !y) return;
  e.preventDefault();
  pick(n ? addMonths(cur, n) : addYears(cur, y));
}
function jumpToYear(i: number) {
  pick(moveTo(cur, new Date().getFullYear() + i, new Date(cur).getMonth()));
}

// ---------------------------------------------------------------- 日历

function onGridKey(e: KeyboardEvent) {
  const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
  if (!step) return;
  e.preventDefault();
  pick(cur + step * DAY);
  // 方向键换日之后，格子可能整页换了月：渲染完把焦点交还给选中的那格
  void nextTick(() => gridEl.value?.querySelector<HTMLElement>(".is-sel")?.focus());
}
function pickDay(c: Date) {
  const t = new Date(cur);
  pick(new Date(c.getFullYear(), c.getMonth(), c.getDate(), t.getHours(), t.getMinutes()).getTime(), true);
}

// ---------------------------------------------------------------- 表盘

function setHM(h: number, m: number) {
  const d = new Date(cur);
  d.setHours(h, m, 0, 0);
  pick(d.getTime());
}
function setAmPm(ap: "am" | "pm") {
  const d = new Date(cur);
  const h = d.getHours();
  if (ap === "am" && h >= 12) setHM(h - 12, d.getMinutes());
  if (ap === "pm" && h < 12) setHM(h + 12, d.getMinutes());
}
function dialApply(e: PointerEvent) {
  const r = dialEl.value!.getBoundingClientRect();
  const a = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
  const d = new Date(cur);
  const h = d.getHours();
  const m = d.getMinutes();
  if (mode.value === "h") return setHM((Math.round(a / 30) % 12) + (h >= 12 ? 12 : 0), m);
  const nm = Math.round(a / 6) % 60;
  setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm); // 越过 12 点进退一小时
}
function onDialDown(e: PointerEvent) {
  dialDrag = true;
  dialDragging.value = true;
  try {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  } catch {
    /* 合成事件没有活动指针 */
  }
  dialApply(e);
}
function onDialMove(e: PointerEvent) {
  if (dialDrag) dialApply(e);
}
function endDial() {
  if (!dialDrag) return;
  dialDrag = false;
  dialDragging.value = false;
  if (mode.value === "h") mode.value = "m";
}
function onDialKey(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    mode.value = mode.value === "h" ? "m" : "h";
    return;
  }
  const k = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key];
  if (!k) return;
  e.preventDefault();
  pick(cur + k * (mode.value === "h" ? 60 : 1) * MIN);
}

// ---------------------------------------------------------------- 渲染所需的派生值

const d = computed(() => new Date(props.value));
const h = computed(() => d.value.getHours());
const m = computed(() => d.value.getMinutes());
const isDay = computed(() => h.value >= 6 && h.value < 18);
const today = computed(() => new Date(now.value));
const Y = computed(() => today.value.getFullYear());
const vy = computed(() => view.value.getFullYear());
const vm = computed(() => view.value.getMonth());
const lo = computed(() => {
  const x = new Date((now.value, LIMITS.minOpen()));
  x.setHours(0, 0, 0, 0);
  return x;
});
const hi = computed(() => {
  const x = new Date(maxOpen.value);
  x.setHours(23, 59, 59, 999);
  return x;
});
const cells = computed(() => {
  const lead = (new Date(vy.value, vm.value, 1).getDay() + 6) % 7;
  const t0 = new Date(today.value);
  t0.setHours(0, 0, 0, 0);
  const s0 = new Date(d.value);
  s0.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, i) => {
    const c = new Date(vy.value, vm.value, 1 - lead + i);
    const cls = ["mcal__d"];
    const sel = sameDay(c, d.value);
    if (c.getMonth() !== vm.value) cls.push("is-out");
    if (sameDay(c, today.value)) cls.push("is-today");
    if (c > t0 && c < s0) cls.push("is-span");
    if (sel) cls.push("is-sel");
    return { c, sel, cls: cls.join(" "), off: c < lo.value || c > hi.value, key: `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}` };
  });
});
const yrs = computed(() => vy.value - Y.value);
const parts = computed(() => eta(props.value, now.value));
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
</script>

<template>
  <div ref="rootEl" :class="['dtp', { 'is-open': open }]" @keydown="onRootKey">
    <button
      ref="triggerEl"
      class="dtp__trigger"
      type="button"
      id="openAt"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-controls="dtpPanel"
      aria-describedby="dtpVal"
      data-testid="create-openat"
      :data-value="new Date(value).toISOString()"
      @click="setOpen(!open)"
    >
      <AppIcon name="calendar" class="ic--cal" />
      <span id="dtpVal" class="dtp__val">
        <span class="dtp__date">{{ `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日` }}</span>
        <span class="dtp__wd">{{ WD[d.getDay()] }}</span>
        <span class="dtp__time">{{ `${pad2(h)}:${pad2(m)}` }}</span>
      </span>
      <span class="dtp__rel">{{ rel(value, now) }}</span>
      <AppIcon name="chev-down" class="ic--chev" />
    </button>
    <div id="dtpPanel" class="dtp__panel" role="dialog" aria-label="选择开启时间">
      <div class="dtp__clip">
        <div class="dtp__in">
          <div class="orbit">
            <div class="dtp__k">
              十年星轨<b>{{ `${(f * 10).toFixed(1)} / 10 年` }}</b>
            </div>
            <div
              ref="railEl"
              :class="['orbit__rail', { 'is-drag': railDragging }]"
              @pointerdown="onRailDown"
              @pointermove="onRailMove"
              @pointerup="endRail"
              @pointercancel="endRail"
            >
              <div class="orbit__line" />
              <div class="orbit__trail" :style="{ width: `${(f * 100).toFixed(2)}%` }" />
              <div>
                <button
                  v-for="i in NODE_IDX"
                  :key="i"
                  :class="['orbit__node', { 'is-past': i > 0 && i / 10 <= f + 1e-6, 'is-cur': Y + i === d.getFullYear() }]"
                  type="button"
                  :style="{ left: `${i * 10}%` }"
                  :aria-label="`穿越到 ${Y + i} 年`"
                  @click="jumpToYear(i)"
                >
                  <i />
                  <span>{{ i ? Y + i : "今年" }}</span>
                </button>
              </div>
              <div
                class="orbit__cap"
                :style="{ left: `${(f * 100).toFixed(2)}%` }"
                tabindex="0"
                role="slider"
                aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）"
                :aria-valuetext="`${d.getFullYear()} 年 ${d.getMonth() + 1} 月`"
                @keydown="onCapKey"
              >
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path class="orbit__cap-top" d="M9 16V11a7 7 0 0 1 14 0v5Z" />
                  <path class="orbit__cap-bot" d="M9 16v5a7 7 0 0 0 14 0v-5Z" />
                  <rect class="orbit__cap-seam" x="8" y="15" width="16" height="2.2" rx="1.1" />
                </svg>
              </div>
            </div>
          </div>

          <div class="dtp__body">
            <div class="mcal">
              <div class="mcal__head">
                <div class="mcal__title">
                  {{ `${vy} 年 ${vm + 1} 月` }}
                  <small>{{ yrs ? `${yrs} 年后` : "今年" }}</small>
                </div>
                <button class="mcal__nav" type="button" aria-label="上个月" :disabled="new Date(vy, vm, 0) < lo" @click="view = new Date(vy, vm - 1, 1)">
                  <AppIcon name="chev-left" />
                </button>
                <button class="mcal__nav" type="button" aria-label="下个月" :disabled="new Date(vy, vm + 1, 1) > hi" @click="view = new Date(vy, vm + 1, 1)">
                  <AppIcon name="chev-right" />
                </button>
              </div>
              <div class="mcal__dow">
                <span v-for="w in DOW" :key="w">{{ w }}</span>
              </div>
              <div ref="gridEl" class="mcal__grid" role="grid" aria-label="日期" @keydown="onGridKey">
                <button
                  v-for="cell in cells"
                  :key="cell.key"
                  type="button"
                  role="gridcell"
                  :class="cell.cls"
                  :disabled="cell.off"
                  :tabindex="cell.sel ? 0 : -1"
                  :aria-selected="cell.sel"
                  :aria-label="`${cell.c.getFullYear()}年${cell.c.getMonth() + 1}月${cell.c.getDate()}日`"
                  @click="pickDay(cell.c)"
                >
                  {{ cell.c.getDate() }}
                </button>
              </div>
            </div>

            <div :class="['clock', isDay ? 'is-day' : 'is-night']" :data-mode="mode">
              <div class="clock__read">
                <div class="clock__seg">
                  <button type="button" :class="{ 'is-on': mode === 'h' }" aria-label="调小时" @click="mode = 'h'">{{ pad2(h) }}</button>
                  <i>:</i>
                  <button type="button" :class="{ 'is-on': mode === 'm' }" aria-label="调分钟" @click="mode = 'm'">{{ pad2(m) }}</button>
                </div>
                <div class="ampm">
                  <button type="button" :class="{ 'is-on': h < 12 }" @click="setAmPm('am')">
                    <AppIcon name="sun" />
                    上午
                  </button>
                  <button type="button" :class="{ 'is-on': h >= 12 }" @click="setAmPm('pm')">
                    <AppIcon name="moon" />
                    下午
                  </button>
                </div>
              </div>
              <div class="clock__case">
                <i class="clock__crown" aria-hidden="true" />
                <svg
                  ref="dialEl"
                  :class="['clock__dial', { 'is-drag': dialDragging }]"
                  viewBox="-12 -12 244 244"
                  tabindex="0"
                  role="slider"
                  aria-label="表盘：拖动指针调整时刻"
                  :aria-valuetext="`${h} 点 ${m} 分`"
                  @pointerdown="onDialDown"
                  @pointermove="onDialMove"
                  @pointerup="endDial"
                  @pointercancel="endDial"
                  @keydown="onDialKey"
                >
                  <defs>
                    <!-- amber-dtp-hand 的 id 被 spec 样式（.clock__hand--h line）按名字引用，不能改 -->
                    <linearGradient id="amber-dtp-hand" gradientUnits="userSpaceOnUse" x1="110" y1="118" x2="110" y2="58">
                      <stop class="clock__g-hand-a" offset="0" />
                      <stop class="clock__g-hand-b" offset="1" />
                    </linearGradient>
                    <radialGradient id="amber-dtp-day" cx=".5" cy=".78" r=".75">
                      <stop class="clock__g-day" offset="0" stop-opacity=".35" />
                      <stop class="clock__g-day" offset="1" stop-opacity="0" />
                    </radialGradient>
                    <radialGradient id="amber-dtp-night" cx=".5" cy=".3" r=".8">
                      <stop class="clock__g-night" offset="0" stop-opacity=".32" />
                      <stop class="clock__g-night" offset="1" stop-opacity="0" />
                    </radialGradient>
                    <radialGradient id="amber-dtp-edge" cx=".5" cy=".5" r=".5">
                      <stop class="clock__g-edge" offset=".82" stop-opacity="0" />
                      <stop class="clock__g-edge" offset="1" stop-opacity=".22" />
                    </radialGradient>
                    <clipPath id="amber-dtp-face">
                      <circle cx="110" cy="110" r="110" />
                    </clipPath>
                  </defs>
                  <circle class="clock__face" cx="110" cy="110" r="110" />
                  <g clip-path="url(#amber-dtp-face)">
                    <g class="clock__sky clock__sky--day">
                      <rect width="220" height="220" fill="url(#amber-dtp-day)" />
                      <circle class="clock__sun" cx="110" cy="160" r="13" />
                      <circle class="clock__sun clock__sun--halo" cx="110" cy="160" r="22" />
                    </g>
                    <g class="clock__sky clock__sky--night">
                      <rect width="220" height="220" fill="url(#amber-dtp-night)" />
                      <path class="clock__moon" d="M118 150a12 12 0 1 1-12.5-14 9.5 9.5 0 0 0 12.5 14Z" />
                      <g class="clock__stars">
                        <circle cx="72" cy="68" r="1.2" opacity=".8" />
                        <circle cx="150" cy="62" r="1" opacity=".6" />
                        <circle cx="160" cy="140" r="1.4" opacity=".7" />
                        <circle cx="58" cy="132" r="1" opacity=".5" />
                        <circle cx="132" cy="172" r=".9" opacity=".6" />
                        <circle cx="84" cy="172" r="1.1" opacity=".5" />
                      </g>
                    </g>
                  </g>
                  <circle class="clock__vignette" cx="110" cy="110" r="110" fill="url(#amber-dtp-edge)" />
                  <circle class="clock__rehaut" cx="110" cy="110" r="102" />
                  <g>
                    <line v-for="t in DIAL_TICKS" :key="t.i" :class="['clock__tick', { 'is-5': t.five }]" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
                  </g>
                  <g>
                    <text v-for="n in DIAL_NUMS" :key="n.h" :class="['clock__num', { 'is-q': n.q }]" :x="n.x" :y="n.y">{{ n.h }}</text>
                  </g>
                  <g>
                    <template v-for="b in DIAL_BEZEL" :key="b.i">
                      <path v-if="b.kind === 'lume'" class="clock__lume" d="M106 -9h8L110 -3Z" />
                      <text v-else-if="b.kind === 'num'" class="clock__bz clock__bz-n" x="110" y="-5.5" :transform="b.rot">{{ b.i }}</text>
                      <rect v-else-if="b.kind === 'bar'" class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" :transform="b.rot" />
                      <rect v-else-if="b.kind === 'bar-s'" class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" :transform="b.rot" />
                      <circle v-else class="clock__bz" cx="110" cy="-5.5" r=".7" :transform="b.rot" />
                    </template>
                  </g>
                  <text class="clock__brand" x="110" y="64">HELLOTIME</text>
                  <text class="clock__brand clock__brand--sub" x="110" y="74">Automatic · Sealed</text>
                  <g class="clock__date">
                    <rect x="163" y="101" width="24" height="18" rx="3" />
                    <text x="175" y="110.5">{{ d.getDate() }}</text>
                  </g>
                  <g class="clock__hand clock__hand--h" :style="{ transform: `rotate(${angH}deg)` }">
                    <line x1="110" y1="118" x2="110" y2="58" />
                  </g>
                  <g class="clock__hand clock__hand--m" :style="{ transform: `rotate(${angM}deg)` }">
                    <line x1="110" y1="124" x2="110" y2="44" />
                    <circle class="knob" cx="110" cy="44" r="4.5" />
                  </g>
                  <circle class="clock__pin" cx="110" cy="110" r="6" />
                  <path class="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z" />
                </svg>
              </div>
              <div class="clock__hint">{{ mode === "h" ? "拖动时针，松手后自动切到分针" : "拖动分针，越过 12 点会自动进退一小时" }}</div>
            </div>
          </div>

          <div class="dtp__foot">
            <div class="dtp__eta">
              {{ "胶囊将在 " }}<template v-for="p in parts" :key="p.u"><b>{{ p.n }}</b>{{ p.u + " " }}</template>{{ "后开启" }}
              <small v-if="clamped" class="is-warn">{{ `已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${tz}` }}</small>
              <small v-else>{{ `按你所在的时区 ${tz} 计时` }}</small>
            </div>
            <button class="btn btn--primary btn--sm" type="button" @click="closeAndFocus">就这一刻</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
