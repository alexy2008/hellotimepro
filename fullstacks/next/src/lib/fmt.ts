// ============================================================
// 时间与数字的说法：两套皮肤共用，与 2.0 原型的 HT.fmt 一致。
// 入参统一用毫秒时间戳；接口给的 ISO 字符串先过一遍 ms()。
// ============================================================

export const ms = (iso: string | number): number =>
  typeof iso === "number" ? iso : new Date(iso).getTime();

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const SSR_TIME_ZONE = "Asia/Shanghai";

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

/** 传入时区时，用固定的日历字段格式化首屏。未指定时沿用本机时区。 */
export function dateFormat(timeZone?: string) {
  const formatter = timeZone && new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  });

  function parts(t: number) {
    const d = new Date(t);
    if (!formatter) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    }
    const fields = Object.fromEntries(formatter.formatToParts(d).map(({ type, value }) => [type, Number(value)]));
    return { year: fields.year, month: fields.month, day: fields.day,
      hour: fields.hour, minute: fields.minute, second: fields.second };
  }

  const format = {
    year: (t: number) => parts(t).year,
    date(t: number) {
      const { year, month, day } = parts(t);
      return `${year}.${pad2(month)}.${pad2(day)}`;
    },
    time(t: number, sec = false) {
      const { hour, minute, second } = parts(t);
      return `${pad2(hour)}:${pad2(minute)}${sec ? ":" + pad2(second) : ""}`;
    },
    dateTime(t: number) {
      return format.date(t) + " " + format.time(t);
    },
    cn(t: number) {
      const { year, month, day } = parts(t);
      return `${year}年${month}月${day}日`;
    },
    week(t: number) {
      const { year, month, day } = parts(t);
      return "星期" + WEEK[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    },
    full(t: number) {
      return `${format.cn(t)} ${format.week(t)} ${format.time(t)}`;
    },
    /** 农历：浏览器自带的中国历，不支持时返回空串 */
    lunar(t: number) {
      try {
        const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
          timeZone,
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
  };
  return format;
}

export const fmt = {
  ...dateFormat(),
  num(n: number) {
    return Number(n).toLocaleString("zh-CN");
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

/** 延迟自动聚焦：只在用户还没把焦点放到别处时生效，不抢已经聚焦的控件 */
export function focusIfIdle(el: HTMLElement | null | undefined) {
  const a = document.activeElement;
  if (el && (!a || a === document.body)) el.focus({ preventScroll: true });
}

/** 往后数 n 个日历年的同一时刻（UTC）；2 月 29 日落到平年时取 2 月 28 日——与服务端的上限算法一致 */
export function addCalendarYears(t: number, n: number): number {
  const d = new Date(t);
  const out = new Date(t);
  out.setUTCFullYear(d.getUTCFullYear() + n);
  if (out.getUTCMonth() !== d.getUTCMonth()) out.setUTCDate(0);
  return out.getTime();
}
