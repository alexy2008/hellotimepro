<!-- 日历：精确到分钟。选中的那天被朱笔圈出（换了日子时重画一遍） -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { clamp, fmt } from "@/lib/fmt";
import { LIMITS } from "@/lib/schedule";
import AppIcon from "@/components/AppIcon.vue";
import PaperTimeInput from "./PaperTimeInput.vue";

const props = defineProps<{ openAt: number }>();
const emit = defineEmits<{ pick: [t: number] }>();

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sel = computed(() => new Date(props.openAt));
const month = ref(new Date(sel.value.getFullYear(), sel.value.getMonth(), 1));
// 外部（预设 / 标尺）改了日子，翻到那个月
watch(
  () => [sel.value.getFullYear(), sel.value.getMonth()] as const,
  ([y, m]) => (month.value = new Date(y, m, 1)),
);

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
const y = computed(() => month.value.getFullYear());
const mo = computed(() => month.value.getMonth());
const lo = computed(() => {
  const d = new Date(LIMITS.minOpen() + 30_000);
  d.setHours(0, 0, 0, 0);
  return d;
});
const hi = computed(() => {
  const d = new Date(LIMITS.maxOpen());
  d.setHours(23, 59, 59, 999);
  return d;
});
const days = computed(() => {
  const lead = (new Date(y.value, mo.value, 1).getDay() + 6) % 7;
  const today = new Date();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(y.value, mo.value, 1 - lead + i);
    return {
      d,
      out: d.getMonth() !== mo.value,
      dis: d < lo.value || d > hi.value,
      today: sameDay(d, today),
      sel: sameDay(d, sel.value),
    };
  });
});
const selKey = computed(() => `${sel.value.getFullYear()}-${sel.value.getMonth()}-${sel.value.getDate()}`);

const nav = (n: number) => (month.value = new Date(y.value, mo.value + n, 1));

function pickDay(d: Date) {
  const cur = new Date(props.openAt);
  const t = new Date(d);
  t.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
  emit("pick", t.getTime());
}
function commitTime(which: "h" | "m", raw: string) {
  const cur = new Date(props.openAt);
  const n = clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
  if (which === "h") cur.setHours(n);
  else cur.setMinutes(n);
  emit("pick", cur.getTime());
}
</script>

<template>
  <div class="cal">
    <div class="cal__head">
      <button class="cal__nav" type="button" aria-label="上一年" :disabled="new Date(y - 1, mo + 1, 0) < lo" @click="nav(-12)">«</button>
      <button class="cal__nav" type="button" aria-label="上个月" :disabled="new Date(y, mo, 0) < lo" @click="nav(-1)">‹</button>
      <div class="cal__title serif"><b class="latin">{{ y }}</b> 年 <b class="latin">{{ mo + 1 }}</b> 月</div>
      <button class="cal__nav" type="button" aria-label="下个月" :disabled="new Date(y, mo + 1, 1) > hi" @click="nav(1)">›</button>
      <button class="cal__nav" type="button" aria-label="下一年" :disabled="new Date(y + 1, mo, 1) > hi" @click="nav(12)">»</button>
    </div>
    <div class="cal__dow">
      <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</span>
    </div>
    <div class="cal__grid">
      <button
        v-for="(it, i) in days"
        :key="i"
        type="button"
        :class="['cal__d', { 'is-out': it.out, 'is-today': it.today, 'is-sel': it.sel }]"
        :disabled="it.dis"
        :aria-label="fmt.cn(it.d.getTime())"
        :aria-current="it.sel ? 'date' : undefined"
        @click="pickDay(it.d)"
      >
        {{ it.d.getDate() }}
        <svg v-if="it.sel" :key="selKey" class="cal__ring is-draw" viewBox="0 0 40 40" aria-hidden="true">
          <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6" />
        </svg>
      </button>
    </div>
    <div class="cal__time">
      <span class="cal__time-k"><AppIcon name="clock" />时刻</span>
      <PaperTimeInput which="h" :open-at="openAt" @commit="commitTime" />
      <i>:</i>
      <PaperTimeInput which="m" :open-at="openAt" @commit="commitTime" />
      <span class="cal__tz mono">{{ tz }}</span>
    </div>
  </div>
</template>
