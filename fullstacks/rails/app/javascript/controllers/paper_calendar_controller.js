import { Controller } from "@hotwired/stimulus";
import { DAY, addDays, calendarDays, clamp, clampOpen, dayStart, localDateTime, maxOpen, minOpen, pad } from "lib/date";

const KEY_DAYS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
const KEY_DISTANCE = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10, PageUp: 100, PageDown: -100 };
const SCALE_WIDTH = 1760;
const LABELS = [
  [0, "现在"], [1, "一天"], [7, "一周"], [30, "一月"], [90, "三月"], [182, "半年"],
  [365, "一年"], [730, "两年"], [1826, "五年"],
];

// 对数标尺在近端分配更多精细刻度，远端仍可直接跳到 10 年。
const logWindow = (now) => Math.log1p((maxOpen() - now) / DAY);
const toOffset = (days, now) => SCALE_WIDTH * Math.log1p(Math.max(0, days)) / logWindow(now);
const toTime = (offset, now) => now + Math.expm1(offset / SCALE_WIDTH * logWindow(now)) * DAY;

export default class extends Controller {
  static targets = ["ruler", "scale", "date", "trigger", "panel", "month", "grid", "clock", "zone", "navigation"];

  connect() {
    this.zoneTarget.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.drawScale();
    const time = Date.parse(this.element.closest("form").elements.openAt.value);
    if (Number.isFinite(time)) this.update(time);
  }

  setTime({ detail }) {
    if (detail.source !== "paper") this.update(detail.time);
  }

  update(time) {
    this.time = time;
    const date = new Date(time);
    this.view = new Date(date.getFullYear(), date.getMonth(), 1);
    this.dateTarget.textContent = localDateTime.format(date);
    this.dateTarget.dateTime = date.toISOString();
    const now = Date.now();
    this.offset = clamp(toOffset((time - now) / DAY, now), 0, SCALE_WIDTH);
    this.scaleTarget.style.transform = `translateX(${-this.offset}px)`;
    this.rulerTarget.setAttribute("aria-valuenow", Math.round(this.offset / SCALE_WIDTH * 100));
    this.rulerTarget.setAttribute("aria-valuetext", this.dateTarget.textContent);
    this.clockTarget.value = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (!this.panelTarget.hidden) this.renderDays();
  }

  choose(time) {
    this.update(clampOpen(time));
    this.dispatch("picked", { detail: { time: this.time, source: "paper" }, prefix: "time-picker" });
  }

  drawScale() {
    const ticks = Array.from({ length: SCALE_WIDTH / 10 + 1 }, (_, index) => {
      const tick = document.createElement("i");
      tick.className = index % 4 ? "rt" : "rt rt--mid";
      tick.style.left = `${index * 10}px`;
      return tick;
    });
    const now = Date.now();
    for (const [offset, label] of [...LABELS.map(([days, text]) => [toOffset(days, now), text]), [SCALE_WIDTH, "十年"]]) {
      const mark = document.createElement("i");
      mark.className = "rt rt--major";
      mark.style.left = `${offset}px`;
      const caption = document.createElement("b");
      caption.textContent = label;
      mark.append(caption);
      ticks.push(mark);
    }
    this.scaleTarget.replaceChildren(...ticks);
  }

  startSlide(event) {
    if (!event.isPrimary || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: event.clientX, offset: this.offset };
    this.rulerTarget.setPointerCapture(event.pointerId);
    this.rulerTarget.classList.add("is-drag");
  }

  slide(event) {
    if (event.pointerId !== this.drag?.id) return;
    this.selectOffset(this.drag.offset + this.drag.x - event.clientX);
  }

  endSlide() {
    this.drag = null;
    this.rulerTarget.classList.remove("is-drag");
  }

  rulerKey(event) {
    const offset = { Home: 0, End: SCALE_WIDTH }[event.key] ??
      (KEY_DISTANCE[event.key] && this.offset + KEY_DISTANCE[event.key]);
    if (offset === undefined) return;
    event.preventDefault();
    this.selectOffset(offset);
  }

  selectOffset(offset) {
    this.choose(toTime(clamp(offset, 0, SCALE_WIDTH), Date.now()));
  }

  toggle() {
    if (!this.panelTarget.hidden) return this.close();
    this.panelTarget.hidden = false;
    this.panelTarget.classList.add("is-open");
    this.triggerTarget.setAttribute("aria-expanded", "true");
    this.renderDays();
  }

  close(event) {
    if (this.panelTarget.hidden) return;
    this.panelTarget.hidden = true;
    this.panelTarget.classList.remove("is-open");
    this.triggerTarget.setAttribute("aria-expanded", "false");
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
