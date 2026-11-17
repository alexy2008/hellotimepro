// ============================================================
// 时间与数字的说法：两套皮肤共用，与 2.0 原型的 HT.fmt 一致。
// 入参统一用毫秒时间戳；接口给的 ISO 字符串先过一遍 ms()。
// ============================================================

export const ms = (iso: string | number): number =>
  typeof iso === "number" ? iso : new Date(iso).getTime();

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const LUNAR_MONTH = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function lunarDay(n: number): string {
  if (n <= 10) return "初" + CN_NUM[n];
  if (n < 20) return "十" + CN_NUM[n - 10];
  if (n === 20) return "二十";
  if (n < 30) return "廿" + CN_NUM[n - 20];
  return "三十";
}

export interface Countdown {
  expired: boolean;
  total: number;
  d: number;
  h: number;
  m: number;
  s: number;
}

export const fmt = {
  date(t: number) {
    const d = new Date(t);
    return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  },
  time(t: number, sec = false) {
    const d = new Date(t);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? ":" + pad2(d.getSeconds()) : ""}`;
  },
  dateTime(t: number) {
    return fmt.date(t) + " " + fmt.time(t);
  },
  cn(t: number) {
    const d = new Date(t);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },
  week(t: number) {
    return "星期" + WEEK[new Date(t).getDay()];
  },
  full(t: number) {
    return `${fmt.cn(t)} ${fmt.week(t)} ${fmt.time(t)}`;
  },
  num(n: number) {
    return Number(n).toLocaleString("zh-CN");
  },
  /** 农历：浏览器自带的中国历，不支持时返回空串 */
  lunar(t: number) {
    try {
      const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).formatToParts(new Date(t));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      const year = get("yearName");
      let month = get("month");
      let day = get("day");
      if (/^\d+$/.test(month)) month = LUNAR_MONTH[+month - 1];
      if (month && !/月$/.test(month)) month += "月";
      if (/^\d+$/.test(day)) day = lunarDay(+day);
      return (year ? year + "年" : "") + month + day;
    } catch {
      return "";
    }
  },
  /** 把一段时长说成人话：3 分钟 / 5 小时 / 12 天 / 7 个月 / 2 年 8 个月 */
  span(t: number) {
    const m = Math.max(0, Math.round(t / 60000));
    if (m < 1) return "不到 1 分钟";
    if (m < 60) return m + " 分钟";
    if (m < 1440) {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r && h < 6 ? `${h} 小时 ${r} 分` : `${Math.round(m / 60)} 小时`;
    }
    const days = Math.round(m / 1440);
    if (days < 60) return days + " 天";
    if (days < 360) return Math.round(days / 30.44) + " 个月";
    let y = Math.floor(days / 365.25);
    let mo = Math.round((days - y * 365.25) / 30.44);
    if (mo >= 12) {
      y += 1;
      mo = 0;
    }
    if (y === 0) return "1 年";
    return mo ? `${y} 年 ${mo} 个月` : `${y} 年`;
  },
  cd(openAt: number, now = Date.now()): Countdown {
    const t = Math.max(0, Math.floor((openAt - now) / 1000));
    return {
      expired: openAt <= now,
      total: t,
      d: Math.floor(t / 86400),
      h: Math.floor((t % 86400) / 3600),
      m: Math.floor((t % 3600) / 60),
      s: t % 60,
    };
  },
  /** 等待进度：封存 → 开启 走了百分之几 */
  progress(createdAt: number, openAt: number, now = Date.now()) {
    const span = openAt - createdAt;
    if (span <= 0) return 100;
    return clamp(Math.round(((now - createdAt) / span) * 100), 0, 100);
  },
};

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const sleep = (t: number) => new Promise<void>((r) => setTimeout(r, t));
