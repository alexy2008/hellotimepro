// 通用格式化工具（倒计时 / 时间 / 数字 / datetime-local 互转）
// 与 frontends/react-ts/src/utils/format.ts 1:1 对齐

/** ISO 字符串 → datetime-local input 值（本地时区，无 TZ 后缀） */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** datetime-local input → ISO 字符串（带 TZ） */
export function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

/** 数字两位补零 */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export interface Countdown {
  expired: boolean;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** 倒计时（now 可注入，便于配合外部计时器驱动重渲染） */
export function countdownTo(iso: string, now = Date.now()): Countdown {
  const target = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return {
    expired: target <= now,
    totalSeconds: diff,
    days,
    hours,
    minutes,
    seconds,
  };
}

/** 兼容旧调用 — 与 React 的 countdownTo 同形 */
export const countdown = countdownTo;

/** 格式化为人类可读：YYYY/MM/DD HH:mm（zh-CN locale，与 React fmtDateTime 对齐） */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** YYYY/MM/DD（zh-CN locale） */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 千分位数字 */
export function fmtNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

/**
 * 兼容旧函数名 fmtLocal —— 用 React fmtDateTime 的 zh-CN locale 格式
 * 之前 Next 自实现版用 `-` 分隔，与 React 不一致；这里统一指向 fmtDateTime。
 */
export const fmtLocal = fmtDateTime;
