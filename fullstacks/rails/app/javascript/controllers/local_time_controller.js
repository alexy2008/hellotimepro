import { Controller } from "@hotwired/stimulus";

const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
const minute = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const second = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

const calendar = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const clock = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const LUNAR_MONTH = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function lunarDay(day) {
  if (day <= 10) return `初${CN_NUM[day]}`;
  if (day < 20) return `十${CN_NUM[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${CN_NUM[day - 20]}`;
  return "三十";
}

function formatLunar(now) {
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      year: "numeric", month: "long", day: "numeric",
    }).formatToParts(now);
    const pick = (type) => parts.find((part) => part.type === type)?.value || "";
    const year = pick("yearName");
    let month = pick("month");
    let day = pick("day");
    if (/^\d+$/.test(month)) month = LUNAR_MONTH[Number(month) - 1] || month;
    if (month && !/月$/.test(month)) month += "月";
    if (/^\d+$/.test(day)) day = lunarDay(Number(day));
    return `${year ? `${year}年` : ""}${month}${day}`;
  } catch {
    return "";
  }
}

export default class extends Controller {
  static values = { live: Boolean, precise: Boolean, clock: Boolean, calendar: Boolean, lunar: Boolean };

  connect() {
    if (this.lunarValue) {
      this.element.textContent = formatLunar(new Date());
      return;
    }
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
