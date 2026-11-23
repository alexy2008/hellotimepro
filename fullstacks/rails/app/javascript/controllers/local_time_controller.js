import { Controller } from "@hotwired/stimulus";

const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
const minute = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const second = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export default class extends Controller {
  static values = { live: Boolean, precise: Boolean };

  connect() {
    if (this.liveValue) {
      const tick = () => { this.element.textContent = second.format(new Date()); };
      tick();
      this.timer = setInterval(tick, 1000);
    } else {
      const instant = Date.parse(this.element.dateTime);
      if (Number.isFinite(instant)) this.element.textContent = (this.preciseValue ? minute : date).format(instant);
    }
  }

  disconnect() { clearInterval(this.timer); }
}
