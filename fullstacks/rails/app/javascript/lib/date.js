export const MINUTE = 60_000;
export const DAY = 86_400_000;

export const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
export const pad = (number) => String(number).padStart(2, "0");
export const sameDay = (first, second) => dayStart(first) === dayStart(second);

export function dayStart(date) {
  return new Date(date).setHours(0, 0, 0, 0);
}

export function addDays(time, days) {
  const date = new Date(time);
  return date.setDate(date.getDate() + days);
}

export function moveMonth(time, year, month) {
  const date = new Date(time);
  const day = Math.min(date.getDate(), new Date(year, month + 1, 0).getDate());
  return date.setFullYear(year, month, day);
}

export function addMonths(time, months) {
  const date = new Date(time);
  return moveMonth(time, date.getFullYear(), date.getMonth() + months);
}

export function addYearsUtc(time, years) {
  const date = new Date(time);
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return date.setUTCFullYear(year, month, day);
}

export const minOpen = () => Date.now() + 61_000;
export const maxOpen = () => addYearsUtc(Date.now(), 10) - 5 * MINUTE;
export const clampOpen = (time) => clamp(time, minOpen(), maxOpen());
const atNine = (time) => new Date(time).setHours(9, 0, 0, 0);

export function presetTime(preset) {
  const now = Date.now();
  switch (preset) {
    case "1m": return now + 125_000;
    case "tm": return atNine(addDays(now, 1));
    case "1w": return atNine(addDays(now, 7));
    case "1mo": return atNine(addMonths(now, 1));
    case "1y": return atNine(addMonths(now, 12));
    case "5y": return atNine(addMonths(now, 60));
    case "10y": return atNine(addDays(addMonths(now, 120), -1));
  }
}

export const localDateTime = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

export function calendarDays(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - lead + index));
}

export function span(duration) {
  const minutes = Math.max(0, Math.round(duration / MINUTE));
  if (minutes < 1) return "不到 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder && hours < 6 ? `${hours} 小时 ${remainder} 分` : `${Math.round(minutes / 60)} 小时`;
  }
  const days = Math.round(minutes / 1440);
  if (days < 60) return `${days} 天`;
  if (days < 360) return `${Math.round(days / 30.44)} 个月`;
  const years = Math.floor(days / 365.25);
  const months = Math.round((days - years * 365.25) / 30.44);
  if (months >= 12) return `${years + 1} 年`;
  if (!years) return "1 年";
  return months ? `${years} 年 ${months} 个月` : `${years} 年`;
}
