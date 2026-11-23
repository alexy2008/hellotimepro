import { Controller } from "@hotwired/stimulus";

const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
const minute = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const second = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

const calendar = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const clock = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export default class extends Controller {
  static values = { live: Boolean, precise: Boolean, clock: Boolean, calendar: Boolean };

  connect() {
    if (this.liveValue || this.calendarValue) {
      const tick = () => {
        const now = new Date();
        const label = this.calendarValue ? calendar.format(now)
          : this.clockValue && document.documentElement.dataset.skin === "paper" ? clock.format(now)
          : second.format(now);
        if (this.element.textContent !== label) this.element.textContent = label;
      };
      tick();
      this.timer = setInterval(tick, 1000);
    } else {
      const instant = Date.parse(this.element.dateTime);
      if (Number.isFinite(instant)) this.element.textContent = (this.preciseValue ? minute : date).format(instant);
    }
  }

  disconnect() { clearInterval(this.timer); }
}
