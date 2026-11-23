import { Controller } from "@hotwired/stimulus";
import { DAY, MINUTE, addDays, addMonths, calendarDays, clamp, clampOpen, dayStart, maxOpen, minOpen, moveMonth, pad } from "lib/date";
import { reducedMotion } from "lib/ui";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DAY_KEYS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const DIAL_KEYS = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 };
const RAIL_KEYS = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 12, PageDown: -12 };
const unwrap = (previous, angle) => previous == null ? angle : previous + (((angle - previous) % 360 + 540) % 360 - 180);

export default class extends Controller {
  connect() {
    this.listeners = new AbortController();
    const { signal } = this.listeners;
    const query = (selector) => this.element.querySelector(selector);
    this.trigger = query(".dtp__trigger");
    this.panel = query(".dtp__panel");
    this.rail = query("[data-rail]");
    this.cap = query("[data-cap]");
    this.grid = query("[data-grid]");
    this.clock = query("[data-clock]");
    this.dial = query("[data-dial]");
    this.mode = "h";

    const nodes = query("[data-nodes]");
    const currentYear = new Date().getFullYear();
    nodes.replaceChildren(...Array.from({ length: 11 }, (_, index) => {
      const button = document.createElement("button");
      button.className = "orbit__node";
      button.type = "button";
      button.style.left = `${index * 10}%`;
      button.dataset.i = index;
      button.dataset.year = currentYear + index;
      button.setAttribute("aria-label", `穿越到 ${currentYear + index} 年`);
      const text = document.createElement("span");
      text.textContent = index ? currentYear + index : "今年";
      button.append(document.createElement("i"), text);
      return button;
    }));
    this.nodes = Array.from(nodes.children);

    this.element.addEventListener("click", (event) => this.click(event), { signal });
    this.element.addEventListener("keydown", (event) => this.key(event), { signal });
    this.bindDrag(this.rail, (event) => this.dragRail(event), () => {}, signal, ".orbit__node");
    this.bindDrag(this.dial, (event) => this.dragDial(event), () => {
      if (this.mode === "h") this.setMode("m");
    }, signal);
    this.setMode("h");
    const time = Date.parse(this.element.closest("form").elements.openAt.value);
    this.setTime({ detail: { time: Number.isFinite(time) ? time : Date.now() + DAY } });
  }

  disconnect() {
    this.close();
    this.listeners.abort();
  }

  setTime({ detail: { time, source } }) {
    if (!this.trigger || source === "amber") return;
    this.time = time;
    this.clamped = false;
    this.follow();
    this.render();
  }

  follow() {
    const date = new Date(this.time);
    this.view = new Date(date.getFullYear(), date.getMonth(), 1);
  }

  pick(time) {
    this.time = clampOpen(time);
    this.clamped = this.time !== time;
    this.follow();
    this.render();
    this.dispatch("picked", { detail: { time: this.time, source: "amber" }, prefix: "time-picker" });
  }

  click(event) {
    const { target } = event;
    if (this.trigger.contains(target)) {
      if (this.panel.inert) this.open();
      else this.close();
      return;
    }
    if (target.closest("[data-done]")) {
      this.close();
      this.trigger.focus({ preventScroll: true });
      return;
    }
    const year = target.closest("[data-year]");
    if (year) return this.pick(moveMonth(this.time, Number(year.dataset.year), new Date(this.time).getMonth()));
    const navigation = target.closest("[data-calnav]");
    if (navigation) {
      this.view.setMonth(this.view.getMonth() + Number(navigation.dataset.calnav));
      this.renderCalendar();
      return;
    }
    const day = target.closest("[data-date]");
    if (day && !day.disabled) {
      const date = new Date(this.time);
      this.pick(new Date(Number(day.dataset.date)).setHours(date.getHours(), date.getMinutes(), 0, 0));
      this.grid.querySelector(".is-sel")?.focus({ preventScroll: true });
      return;
    }
    const segment = target.closest("[data-seg]");
    if (segment) return this.setMode(segment.dataset.seg);
    const period = target.closest("[data-ampm]");
    if (period) {
      const date = new Date(this.time);
      const hours = date.getHours() % 12 + (period.dataset.ampm === "am" ? 0 : 12);
      this.pick(date.setHours(hours));
    }
  }

  key(event) {
    if (event.key === "Escape" && !this.panel.inert) {
      event.stopPropagation();
      this.close();
      this.trigger.focus({ preventScroll: true });
      return;
    }
    if (event.target === this.cap) {
      const months = RAIL_KEYS[event.key];
      if (!months) return;
      event.preventDefault();
      this.pick(addMonths(this.time, months));
    } else if (this.grid.contains(event.target) && DAY_KEYS[event.key]) {
      event.preventDefault();
      this.pick(addDays(this.time, DAY_KEYS[event.key]));
      this.grid.querySelector(".is-sel")?.focus({ preventScroll: true });
    } else if (event.target === this.dial) {
      const delta = DIAL_KEYS[event.key];
      if (event.key === "Enter") {
        event.preventDefault();
        this.setMode(this.mode === "h" ? "m" : "h");
      } else if (delta) {
        event.preventDefault();
        this.pick(this.time + delta * MINUTE * (this.mode === "h" ? 60 : 1));
      }
    }
  }

  bindDrag(node, apply, finish, signal, skip) {
    let active;
    node.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || (skip && event.target.closest(skip))) return;
      active = event.pointerId;
      node.setPointerCapture(active);
      node.classList.add("is-drag");
      apply(event);
    }, { signal });
    node.addEventListener("pointermove", (event) => {
      if (event.pointerId === active) apply(event);
    }, { signal });
    node.addEventListener("lostpointercapture", (event) => {
      if (event.pointerId !== active) return;
      active = undefined;
      node.classList.remove("is-drag");
      finish();
    }, { signal });
  }

  dragRail(event) {
    const rect = this.rail.getBoundingClientRect();
    const rate = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const now = minOpen(), limit = maxOpen();
    const date = new Date(now + rate * (limit - now));
    const current = new Date(this.time);
    this.pick(date.setHours(current.getHours(), current.getMinutes(), 0, 0));
  }

  dragDial(event) {
    const rect = this.dial.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = (rect.top + rect.height / 2) - event.clientY;
    const angle = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const date = new Date(this.time);
    const hours = date.getHours(), minutes = date.getMinutes();
    if (this.mode === "h") {
      const chosen = Math.round(angle / 30) % 12 + (hours >= 12 ? 12 : 0);
      this.pick(date.setHours(chosen, minutes, 0, 0));
    } else {
      const chosen = Math.round(angle / 6) % 60;
      const distance = (chosen - minutes + 90) % 60 - 30;
      this.pick(date.setMinutes(minutes + distance, 0, 0));
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.clock.dataset.mode = mode;
    this.clock.querySelectorAll("[data-seg]").forEach((button) => button.classList.toggle("is-on", button.dataset.seg === mode));
    this.clock.querySelector("[data-hint]").textContent = mode === "h" ? "拖动时针，松手后自动切到分针" : "拖动分针，越过 12 点会自动进退一小时";
  }

  render() {
    const date = new Date(this.time);
    const set = (selector, value) => { this.element.querySelector(selector).textContent = value; };
    const now = Date.now();
    const fraction = clamp((this.time - now) / (maxOpen() - now), 0, 1);
    set(".dtp__date", `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`);
    set(".dtp__wd", WEEKDAYS[date.getDay()]);
    set(".dtp__time", `${pad(date.getHours())}:${pad(date.getMinutes())}`);
    set(".dtp__rel", this.relativeTime(this.time - now));
    set("[data-pct]", `${(fraction * 10).toFixed(1)} / 10 年`);
    this.trigger.dataset.value = date.toISOString();
    this.cap.style.left = this.element.querySelector("[data-trail]").style.width = `${fraction * 100}%`;
    this.cap.setAttribute("aria-valuenow", Math.round(fraction * 100));
    this.cap.setAttribute("aria-valuetext", `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`);
    this.nodes.forEach((node, index) => {
      node.classList.toggle("is-past", index > 0 && index / 10 <= fraction);
      node.classList.toggle("is-cur", Number(node.dataset.year) === date.getFullYear());
    });

    const eta = this.element.querySelector("[data-eta]");
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const duration = this.duration(now);
    const note = document.createElement("small");
    note.classList.toggle("is-warn", this.clamped);
    note.textContent = this.clamped ? `已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${zone}` : `按你所在的时区 ${zone} 计时`;
    eta.replaceChildren(`胶囊将在 ${duration} 后开启`, note);
    if (!this.panel.inert) this.renderCalendar();
    this.renderClock(date);
  }

  relativeTime(delay) {
    if (delay < 60 * MINUTE) return `${Math.max(1, Math.round(delay / MINUTE))} 分钟后`;
    if (delay < DAY) return `${Math.round(delay / (60 * MINUTE))} 小时后`;
    if (delay < 45 * DAY) return `${Math.round(delay / DAY)} 天后`;
    if (delay < 330 * DAY) return `约 ${Math.round(delay / (30.44 * DAY))} 个月后`;
    return `约 ${Math.round(delay / (365.25 * DAY))} 年后`;
  }

  duration(now) {
    const end = this.time + 30_000;
    let years = 0, months = 0;
    while (addMonths(now, (years + 1) * 12) <= end) years++;
    while (addMonths(now, years * 12 + months + 1) <= end) months++;
    const remainder = Math.max(0, end - addMonths(now, years * 12 + months));
    const days = Math.floor(remainder / DAY), hours = Math.floor(remainder / (60 * MINUTE)) % 24;
    const minutes = Math.floor(remainder / MINUTE) % 60;
    return [years && `${years} 年`, months && `${months} 个月`, days && `${days} 天`, `${hours} 小时`, `${minutes} 分`].filter(Boolean).join(" ");
  }

  renderClock(date) {
    const hours = date.getHours(), minutes = date.getMinutes();
    this.hourAngle = unwrap(this.hourAngle, (hours % 12 + minutes / 60) * 30);
    this.minuteAngle = unwrap(this.minuteAngle, minutes * 6);
    this.clock.querySelector('[data-hand="h"]').style.transform = `rotate(${this.hourAngle}deg)`;
    this.clock.querySelector('[data-hand="m"]').style.transform = `rotate(${this.minuteAngle}deg)`;
    this.clock.querySelector('[data-seg="h"]').textContent = pad(hours);
    this.clock.querySelector('[data-seg="m"]').textContent = pad(minutes);
    this.clock.querySelector('[data-ampm="am"]').classList.toggle("is-on", hours < 12);
    this.clock.querySelector('[data-ampm="pm"]').classList.toggle("is-on", hours >= 12);
    this.clock.querySelector("[data-datewin]").textContent = date.getDate();
    const daytime = hours >= 6 && hours < 18;
    this.clock.classList.toggle("is-day", daytime);
    this.clock.classList.toggle("is-night", !daytime);
    this.dial.setAttribute("aria-valuemax", this.mode === "h" ? "23" : "59");
    this.dial.setAttribute("aria-valuenow", this.mode === "h" ? hours : minutes);
    this.dial.setAttribute("aria-valuetext", `${hours} 点 ${minutes} 分`);
  }

  renderCalendar() {
    const year = this.view.getFullYear(), month = this.view.getMonth();
    const low = dayStart(minOpen()), high = dayStart(maxOpen());
    const today = dayStart(Date.now()), selected = dayStart(this.time);
    this.element.querySelector("[data-caltitle]").textContent = `${year} 年 ${month + 1} 月`;
    this.element.querySelector('[data-calnav="-1"]').disabled = new Date(year, month, 0) < low;
    this.element.querySelector('[data-calnav="1"]').disabled = new Date(year, month + 1, 1) > high;
    const buttons = calendarDays(year, month).map((date) => {
      const key = date.getTime();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mcal__d";
      button.classList.toggle("is-out", date.getMonth() !== month);
      button.classList.toggle("is-today", key === today);
      button.classList.toggle("is-span", key > today && key < selected);
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
    this.grid.replaceChildren(...buttons);
  }

  open() {
    this.openListeners = new AbortController();
    const { signal } = this.openListeners;
    this.panel.inert = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.element.classList.add("is-open");
    this.render();
    document.addEventListener("pointerdown", (event) => {
      if (!this.element.contains(event.target) && !event.target.closest("[data-preset]")) this.close();
    }, { signal });

    this.frame = requestAnimationFrame(() => this.reveal());
    const settle = () => {
      this.panel.removeEventListener("transitionend", afterTransition);
      clearTimeout(this.settle);
      this.reveal();
    };
    const afterTransition = (event) => {
      if (event.target === this.panel && event.propertyName === "grid-template-rows") settle();
    };
    this.panel.addEventListener("transitionend", afterTransition, { signal });
    this.settle = setTimeout(settle, 500);
  }

  close() {
    if (!this.panel || this.panel.inert) return;
    this.openListeners.abort();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.settle);
    this.panel.inert = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.element.classList.remove("is-open");
    this.setMode("h");
  }

  reveal() {
    if (this.panel.inert) return;
    const top = this.trigger.getBoundingClientRect().top;
    const panelHeight = this.panel.querySelector(".dtp__in").offsetHeight;
    const tabbar = document.querySelector(".tabbar");
    const footerHeight = tabbar ? tabbar.getBoundingClientRect().height : 0;
    const headerHeight = document.querySelector(".hdr").getBoundingClientRect().bottom;
    const overflow = top + this.trigger.offsetHeight + panelHeight - (innerHeight - footerHeight - 16);
    const move = Math.min(overflow, top - headerHeight - 16);
    if (move > 0) window.scrollBy({ top: move, behavior: reducedMotion() ? "instant" : "smooth" });
  }
}
