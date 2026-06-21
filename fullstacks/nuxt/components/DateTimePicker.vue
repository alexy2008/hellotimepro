<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { pad2 } from "@/utils/format";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
type Preset = "1m" | "1h" | "tomorrow9" | "1y" | "y2030";
type ManualField = "year" | "month" | "day" | "hour" | "minute";

interface ManualParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

const props = defineProps<{
  id: string;
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const rootRef = ref<HTMLDivElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);
const open = ref(false);
const placement = ref<"below" | "above">("below");
const maxHeight = ref(460);

function parseLocal(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setSeconds(0, 0);
  return fallback;
}

function toLocalValue(date: Date): string {
  return [
    date.getFullYear(),
    "-",
    pad2(date.getMonth() + 1),
    "-",
    pad2(date.getDate()),
    "T",
    pad2(date.getHours()),
    ":",
    pad2(date.getMinutes()),
  ].join("");
}

function toManualParts(date: Date): ManualParts {
  return {
    year: String(date.getFullYear()),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
    hour: pad2(date.getHours()),
    minute: pad2(date.getMinutes()),
  };
}

function formatDisplay(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDistance(date: Date): string {
  const diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
  if (diffMinutes <= 0) return "已到开启时刻";
  if (diffMinutes < 60) return `距开启 ${diffMinutes} 分钟`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return `距开启 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days < 365) return `距开启 ${days} 天${restHours ? ` ${restHours} 小时` : ""}`;
  const years = Math.floor(days / 365);
  const restDays = days % 365;
  return `距开启 ${years} 年${restDays ? ` ${restDays} 天` : ""}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayFromMonday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function sameDay(date: Date, year: number, month: number, day: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

function todayMatches(year: number, month: number, day: number): boolean {
  return sameDay(new Date(), year, month, day);
}

function withPreset(spec: Preset): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  switch (spec) {
    case "1m":
      next.setMinutes(next.getMinutes() + 2);
      return next;
    case "1h":
      next.setHours(next.getHours() + 1);
      return next;
    case "tomorrow9":
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    case "1y":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    case "y2030":
      return new Date(2030, 0, 1, 0, 0, 0, 0);
  }
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function num(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const valueDate = computed(() => parseLocal(props.modelValue));
const draft = ref(valueDate.value);
const manualParts = ref(toManualParts(valueDate.value));
const viewMonth = ref(new Date(valueDate.value.getFullYear(), valueDate.value.getMonth(), 1));

const year = computed(() => viewMonth.value.getFullYear());
const month = computed(() => viewMonth.value.getMonth());
const leadingBlanks = computed(() => firstWeekdayFromMonday(year.value, month.value));
const totalDays = computed(() => daysInMonth(year.value, month.value));

watch(open, (isOpen) => {
  if (!isOpen) {
    draft.value = valueDate.value;
    viewMonth.value = new Date(valueDate.value.getFullYear(), valueDate.value.getMonth(), 1);
    return;
  }
  void nextTick(updatePlacement);
});

watch(draft, (next) => {
  manualParts.value = toManualParts(next);
});

watch(() => props.modelValue, () => {
  if (!open.value) {
    draft.value = valueDate.value;
    viewMonth.value = new Date(valueDate.value.getFullYear(), valueDate.value.getMonth(), 1);
  }
});

function handlePointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) open.value = false;
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
  } else {
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", updatePlacement);
    window.removeEventListener("scroll", updatePlacement, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("resize", updatePlacement);
  window.removeEventListener("scroll", updatePlacement, true);
});

function updatePlacement() {
  const root = rootRef.value;
  const popover = popoverRef.value;
  if (!root || !popover) return;
  const gap = 8;
  const rect = root.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const popoverHeight = popover.offsetHeight;
  const nextPlacement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "above" : "below";
  const availableSpace = nextPlacement === "above" ? spaceAbove : spaceBelow;
  placement.value = nextPlacement;
  maxHeight.value = Math.max(160, Math.min(460, Math.floor(availableSpace)));
}

function pickDay(day: number) {
  const next = new Date(draft.value);
  next.setFullYear(year.value, month.value, day);
  draft.value = next;
}

function setHour(hour: number) {
  const next = new Date(draft.value);
  next.setHours(hour);
  draft.value = next;
}

function setMinute(minute: number) {
  const next = new Date(draft.value);
  next.setMinutes(minute);
  draft.value = next;
}

function tryCommitManual(parts: ManualParts) {
  if (parts.year.length !== 4 || !parts.month || !parts.day || !parts.hour || !parts.minute) return;
  const y = num(parts.year);
  const m = num(parts.month);
  const d = num(parts.day);
  const h = num(parts.hour);
  const min = num(parts.minute);
  if (y === null || m === null || d === null || h === null || min === null) return;
  if (y < 1 || m < 1 || m > 12 || h < 0 || h > 23 || min < 0 || min > 59) return;
  const maxDay = daysInMonth(y, m - 1);
  if (d < 1 || d > maxDay) return;
  const next = new Date(y, m - 1, d, h, min, 0, 0);
  draft.value = next;
  viewMonth.value = new Date(y, m - 1, 1);
}

function setManualPart(field: ManualField, rawValue: string) {
  const maxLength = field === "year" ? 4 : 2;
  const nextParts = { ...manualParts.value, [field]: onlyDigits(rawValue, maxLength) };
  manualParts.value = nextParts;
  tryCommitManual(nextParts);
}

function adjustManualPart(field: ManualField, delta: number) {
  let next = new Date(draft.value);
  if (field === "year") {
    const y = clamp(draft.value.getFullYear() + delta, 1, 9999);
    next = new Date(y, draft.value.getMonth(), Math.min(draft.value.getDate(), daysInMonth(y, draft.value.getMonth())), draft.value.getHours(), draft.value.getMinutes(), 0, 0);
  } else if (field === "month") {
    const monthBase = new Date(draft.value.getFullYear(), draft.value.getMonth() + delta, 1);
    next = new Date(
      monthBase.getFullYear(),
      monthBase.getMonth(),
      Math.min(draft.value.getDate(), daysInMonth(monthBase.getFullYear(), monthBase.getMonth())),
      draft.value.getHours(),
      draft.value.getMinutes(),
      0,
      0,
    );
  } else if (field === "day") {
    next.setDate(next.getDate() + delta);
  } else if (field === "hour") {
    next.setHours(next.getHours() + delta);
  } else {
    next.setMinutes(next.getMinutes() + delta);
  }
  draft.value = next;
  viewMonth.value = new Date(next.getFullYear(), next.getMonth(), 1);
}

function handleManualKeyDown(event: KeyboardEvent, field: ManualField) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  adjustManualPart(field, event.key === "ArrowUp" ? 1 : -1);
}

function normalizeManualParts() {
  const y = num(manualParts.value.year) ?? draft.value.getFullYear();
  const safeYear = Math.min(9999, Math.max(1, y));
  const m = Math.min(12, Math.max(1, num(manualParts.value.month) ?? draft.value.getMonth() + 1));
  const maxDay = daysInMonth(safeYear, m - 1);
  const d = Math.min(maxDay, Math.max(1, num(manualParts.value.day) ?? draft.value.getDate()));
  const h = Math.min(23, Math.max(0, num(manualParts.value.hour) ?? draft.value.getHours()));
  const min = Math.min(59, Math.max(0, num(manualParts.value.minute) ?? draft.value.getMinutes()));
  const next = new Date(safeYear, m - 1, d, h, min, 0, 0);
  draft.value = next;
  viewMonth.value = new Date(safeYear, m - 1, 1);
}

function applyPreset(spec: Preset) {
  const next = withPreset(spec);
  draft.value = next;
  viewMonth.value = new Date(next.getFullYear(), next.getMonth(), 1);
}

function confirm() {
  emit("update:modelValue", toLocalValue(draft.value));
  open.value = false;
}
</script>

<template>
  <div ref="rootRef" class="cy-dtp">
    <button
      :id="id"
      type="button"
      class="cy-dtp__trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="cy-dtp__trigger-icon" aria-hidden="true">⏱</span>
      <span class="cy-dtp__trigger-main">
        <span class="cy-dtp__trigger-value">
          {{ formatDisplay(valueDate) }}
          <span class="cy-dtp__trigger-hint">{{ formatDistance(valueDate) }}</span>
        </span>
      </span>
      <span class="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span>
    </button>

    <div
      v-if="open"
      ref="popoverRef"
      class="cy-dtp__popover"
      :class="`cy-dtp__popover--${placement}`"
      :style="{ '--cy-dtp-max-height': `${maxHeight}px` }"
      role="dialog"
      :aria-labelledby="`${id}_title`"
    >
      <div class="cy-dtp__topbar">
        <div class="cy-dtp__summary">
          <span :id="`${id}_title`" class="cy-dtp__eyebrow">选择开启时刻</span>
          <strong>{{ formatDistance(draft) }}</strong>
        </div>
        <div class="cy-dtp__manual" aria-label="手动输入开启时间">
          <input
            aria-label="年份"
            inputmode="numeric"
            :value="manualParts.year"
            @blur="normalizeManualParts"
            @keydown="handleManualKeyDown($event, 'year')"
            @input="setManualPart('year', ($event.target as HTMLInputElement).value)"
          />
          <span>年</span>
          <input
            aria-label="月份"
            inputmode="numeric"
            :value="manualParts.month"
            @blur="normalizeManualParts"
            @keydown="handleManualKeyDown($event, 'month')"
            @input="setManualPart('month', ($event.target as HTMLInputElement).value)"
          />
          <span>月</span>
          <input
            aria-label="日期"
            inputmode="numeric"
            :value="manualParts.day"
            @blur="normalizeManualParts"
            @keydown="handleManualKeyDown($event, 'day')"
            @input="setManualPart('day', ($event.target as HTMLInputElement).value)"
          />
          <span>日</span>
          <input
            aria-label="小时"
            inputmode="numeric"
            :value="manualParts.hour"
            @blur="normalizeManualParts"
            @keydown="handleManualKeyDown($event, 'hour')"
            @input="setManualPart('hour', ($event.target as HTMLInputElement).value)"
          />
          <span>:</span>
          <input
            aria-label="分钟"
            inputmode="numeric"
            :value="manualParts.minute"
            @blur="normalizeManualParts"
            @keydown="handleManualKeyDown($event, 'minute')"
            @input="setManualPart('minute', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="cy-dtp__actions">
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="open = false">取消</button>
          <button type="button" class="cy-btn cy-btn--primary cy-btn--sm" @click="confirm">确认</button>
        </div>
      </div>

      <div class="cy-dtp__panel">
        <div class="cy-dtp__calendar">
          <div class="cy-dtp__monthbar">
            <button type="button" aria-label="上个月" @click="viewMonth = addMonths(viewMonth, -1)">‹</button>
            <strong>{{ year }}年{{ month + 1 }}月</strong>
            <button type="button" aria-label="下个月" @click="viewMonth = addMonths(viewMonth, 1)">›</button>
          </div>

          <div class="cy-dtp__weekdays">
            <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
          </div>

          <div class="cy-dtp__days">
            <span v-for="index in leadingBlanks" :key="`blank-${index}`" aria-hidden="true" />
            <button
              v-for="day in totalDays"
              :key="day"
              type="button"
              :class="{ 'is-selected': sameDay(draft, year, month, day), 'is-today': todayMatches(year, month, day) }"
              :aria-pressed="sameDay(draft, year, month, day)"
              @click="pickDay(day)"
            >
              {{ day }}
            </button>
          </div>
        </div>

        <div class="cy-dtp__time">
          <label>
            小时
            <select class="cy-select" :value="draft.getHours()" @change="setHour(Number(($event.target as HTMLSelectElement).value))">
              <option v-for="hour in 24" :key="hour - 1" :value="hour - 1">{{ pad2(hour - 1) }}</option>
            </select>
          </label>
          <label>
            分钟
            <select class="cy-select" :value="draft.getMinutes()" @change="setMinute(Number(($event.target as HTMLSelectElement).value))">
              <option v-for="index in 12" :key="(index - 1) * 5" :value="(index - 1) * 5">{{ pad2((index - 1) * 5) }}</option>
            </select>
          </label>
          <div
            class="cy-dtp__clock"
            aria-label="标准时钟表盘"
            :style="{
              '--cy-dtp-clock-hour-angle': `${(draft.getHours() % 12) * 30 + draft.getMinutes() * 0.5}deg`,
              '--cy-dtp-clock-minute-angle': `${draft.getMinutes() * 6}deg`,
            }"
          >
            <span class="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true" />
            <span class="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true" />
            <span class="cy-dtp__clock-center" aria-hidden="true" />
            <span
              v-for="index in 12"
              :key="index"
              :class="{ 'is-active': draft.getHours() % 12 === index % 12 }"
              :aria-label="`${index} 点`"
              :style="{ transform: `rotate(${index * 30}deg) translateY(-38px) rotate(${-index * 30}deg)` }"
            >
              {{ index }}
            </span>
          </div>
        </div>
      </div>

      <div class="cy-dtp__presets" aria-label="快速预设">
        <button type="button" @click="applyPreset('1m')">1分钟后</button>
        <button type="button" @click="applyPreset('1h')">1小时后</button>
        <button type="button" @click="applyPreset('tomorrow9')">明天9:00</button>
        <button type="button" @click="applyPreset('1y')">1年后</button>
        <button type="button" @click="applyPreset('y2030')">2030.01.01</button>
      </div>
    </div>
  </div>
</template>
