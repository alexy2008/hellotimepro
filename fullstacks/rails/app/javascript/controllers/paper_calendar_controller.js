import { Controller } from "@hotwired/stimulus";
import { DAY, MINUTE, addDays, calendarDays, clamp, clampOpen, dayStart, localDateTime, maxOpen, minOpen, pad, span } from "lib/date";

const KEY_DAYS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
const HOUR = 60 * MINUTE;
const ANCHORS = [
  [2 * MINUTE, "此刻"], [HOUR, "1 小时"], [DAY, "1 天"], [7 * DAY, "1 周"], [30 * DAY, "1 个月"],
  [182 * DAY, "半年"], [365 * DAY, "1 年"], [1096 * DAY, "3 年"], [1826 * DAY, "5 年"], [3651 * DAY, "10 年"],
];
const SEGMENT = 124;
const SCALE_WIDTH = (ANCHORS.length - 1) * SEGMENT;
const DIRECTION = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };

function toOffset(duration) {
  const time = clamp(duration, ANCHORS[0][0], ANCHORS.at(-1)[0]);
  const next = ANCHORS.findIndex(([limit], index) => index > 0 && time <= limit);
  const start = ANCHORS[next - 1][0];
  return SEGMENT * (next - 1 + Math.log(time / start) / Math.log(ANCHORS[next][0] / start));
}

function toTime(offset) {
  const position = clamp(offset, 0, SCALE_WIDTH) / SEGMENT;
  const index = Math.min(Math.floor(position), ANCHORS.length - 2);
  const start = ANCHORS[index][0];
  const duration = start * (ANCHORS[index + 1][0] / start) ** (position - index);
  const date = new Date(Date.now() + duration);
  if (duration < HOUR) date.setSeconds(0, 0);
  else if (duration < DAY) date.setMinutes(Math.round(date.getMinutes() / 5) * 5, 0, 0);
  else if (duration < 30 * DAY) date.setMinutes(0, 0, 0);
  else date.setHours(9, 0, 0, 0);
  return date.getTime();
}

export default class extends Controller {
  static targets = ["ruler", "scale", "date", "distance", "trigger", "panel", "month", "grid", "clock", "zone", "navigation"];

  connect() {
    this.zoneTarget.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.drawScale();
    const time = Date.parse(this.element.closest("form").elements.openAt.value);
    if (Number.isFinite(time)) this.update(time);
  }

  setTime({ detail }) {
    if (detail.source === "paper") return;
    this.rulerTarget.classList.toggle("is-glide", !this.drag);
    this.update(detail.time);
  }

  update(time) {
    this.time = time;
    const date = new Date(time);
    this.view = new Date(date.getFullYear(), date.getMonth(), 1);
    this.dateTarget.textContent = localDateTime.format(date);
    this.dateTarget.dateTime = date.toISOString();
    const now = Date.now();
    this.offset = toOffset(time - now);
    this.position(this.drag?.position ?? this.offset);
    this.distanceTarget.textContent = `${span(time - now)}后`;
    this.rulerTarget.setAttribute("aria-valuenow", Math.round(this.offset / SCALE_WIDTH * 100));
    this.rulerTarget.setAttribute("aria-valuetext", `${this.distanceTarget.textContent}，${this.dateTarget.textContent}`);
    this.clockTarget.value = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (!this.panelTarget.hidden) this.renderDays();
  }

  choose(time) {
    this.update(clampOpen(time));
    this.dispatch("picked", { detail: { time: this.time, source: "paper" }, prefix: "time-picker" });
  }

  drawScale() {
    const ticks = [];
    for (const [index, [, label]] of ANCHORS.entries()) {
      const mark = document.createElement("i");
      mark.className = "rt rt--major";
      mark.style.left = `${index * SEGMENT}px`;
      const caption = document.createElement("b");
      caption.textContent = label;
      mark.append(caption);
      ticks.push(mark);
      if (index === ANCHORS.length - 1) continue;
      for (let step = 1; step < 8; step += 1) {
        const tick = document.createElement("i");
        tick.className = step === 4 ? "rt rt--mid" : "rt";
        tick.style.left = `${(index + step / 8) * SEGMENT}px`;
        ticks.push(tick);
      }
    }
    this.scaleTarget.replaceChildren(...ticks);
  }

  position(offset) {
    this.scaleTarget.style.transform = `translateX(${-offset}px)`;
  }

  startSlide(event) {
    if (!event.isPrimary || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: event.clientX, offset: this.offset };
    this.rulerTarget.setPointerCapture(event.pointerId);
    this.rulerTarget.classList.remove("is-glide");
    this.rulerTarget.classList.add("is-drag");
  }

  slide(event) {
    if (event.pointerId !== this.drag?.id) return;
    const delta = this.drag.x - event.clientX;
    if (this.drag.position === undefined && Math.abs(delta) <= 3) return;
    this.drag.position = clamp(this.drag.offset + delta, 0, SCALE_WIDTH);
    this.choose(toTime(this.drag.position));
  }

  endSlide(event) {
    if (event.pointerId !== this.drag?.id) return;
    const { position, offset } = this.drag;
    this.drag = null;
    this.rulerTarget.classList.remove("is-drag");
    this.rulerTarget.classList.add("is-glide");
    if (position === undefined && event.type === "pointerup") {
      const box = this.rulerTarget.getBoundingClientRect();
      this.choose(toTime(offset + event.clientX - box.left - box.width / 2));
    } else {
      this.position(this.offset);
    }
  }

  rulerKey(event) {
    const step = SCALE_WIDTH * (event.shiftKey ? 0.02 : 0.004);
    const position = this.offset / SEGMENT;
    const offset = {
      Home: 0, End: SCALE_WIDTH,
      PageDown: (Math.ceil(position - 0.001) - 1) * SEGMENT,
      PageUp: (Math.floor(position + 0.001) + 1) * SEGMENT
    }[event.key] ?? (DIRECTION[event.key] && this.offset + step * DIRECTION[event.key]);
    if (offset === undefined) return;
    event.preventDefault();
    this.rulerTarget.classList.remove("is-glide");
    this.choose(toTime(offset));
  }

  toggle() {
    if (!this.panelTarget.hidden) return this.close();
    this.panelTarget.hidden = false;
    this.panelTarget.classList.add("is-open");
    this.triggerTarget.setAttribute("aria-expanded", "true");
    this.triggerTarget.classList.add("is-open");
    this.renderDays();
  }

  close(event) {
    if (this.panelTarget.hidden) return;
    this.panelTarget.hidden = true;
    this.panelTarget.classList.remove("is-open");
    this.triggerTarget.setAttribute("aria-expanded", "false");
    this.triggerTarget.classList.remove("is-open");
    if (event?.type === "keydown") this.triggerTarget.focus();
  }

  navigate({ currentTarget }) {
    this.view.setMonth(this.view.getMonth() + Number(currentTarget.dataset.months));
    this.renderDays();
  }

  pickDay({ target }) {
    const button = target.closest("[data-date]");
    if (!button || button.disabled) return;
    const date = new Date(Number(button.dataset.date));
    const current = new Date(this.time);
    this.choose(date.setHours(current.getHours(), current.getMinutes(), 0, 0));
    this.gridTarget.querySelector('[aria-selected="true"]')?.focus();
  }

  pickClock() {
    const [hour, minute] = this.clockTarget.value.split(":").map(Number);
    if (this.clockTarget.value) this.choose(new Date(this.time).setHours(hour, minute, 0, 0));
  }

  dayKey(event) {
    const days = KEY_DAYS[event.key];
    if (!days) return;
    event.preventDefault();
    this.choose(addDays(this.time, days));
    this.gridTarget.querySelector('[aria-selected="true"]')?.focus();
  }

  renderDays() {
    const year = this.view.getFullYear(), month = this.view.getMonth();
    const low = dayStart(minOpen()), high = dayStart(maxOpen());
    const today = dayStart(Date.now()), selected = dayStart(this.time);
    this.monthTarget.textContent = `${year} 年 ${month + 1} 月`;
    this.navigationTargets.forEach((button) => {
      const shift = Number(button.dataset.months);
      button.disabled = shift < 0 ? new Date(year, month + shift + 1, 0) < low : new Date(year, month + shift, 1) > high;
    });
    const buttons = calendarDays(year, month).map((date) => {
      const key = date.getTime();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cal__d";
      button.classList.toggle("is-out", date.getMonth() !== month);
      button.classList.toggle("is-today", key === today);
      button.classList.toggle("is-sel", key === selected);
      button.dataset.date = key;
      button.disabled = key < low || key > high;
      button.tabIndex = key === selected ? 0 : -1;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-selected", key === selected);
      button.setAttribute("aria-label", date.toLocaleDateString("zh-CN"));
      button.textContent = date.getDate();
      return button;
    });
    if (!buttons.some((button) => button.tabIndex === 0)) {
      const first = buttons.find((button) => !button.disabled && !button.classList.contains("is-out"));
      if (first) first.tabIndex = 0;
    }
    this.gridTarget.replaceChildren(...buttons);
  }
}
