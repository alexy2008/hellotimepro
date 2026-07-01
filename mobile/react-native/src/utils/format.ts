// 通用格式化工具（倒计时 / 时间 / 数字）
// 逐字移植自 frontends/react-ts/src/utils/format.ts。
// localInputToIso / isoToLocalInput 处理本地时间字符串 "YYYY-MM-DDTHH:mm"，
// 供创建页的日期选择器（移动版）使用，与 Web 端语义一致。

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

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function fmtNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

// 把本地时间字符串（YYYY-MM-DDTHH:mm）转成 ISO（UTC）
export function localInputToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

// 把 ISO 转成本地时间字符串（YYYY-MM-DDTHH:mm）
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
