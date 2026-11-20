// ============================================================
// 「琥珀」的纯函数小件
// ============================================================

import { fmt, pad2 } from '@/lib/fmt';

/** 紧凑倒计时（卡片用）：00:59:12 或 3,508 天 23:54:25 */
export function cdShort(openAt: number, now: number) {
  const c = fmt.cd(openAt, now);
  const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
  return c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
}

/** 2026-11-21 09:00 这种连字符写法 */
export const dash = (t: number) => fmt.dateTime(t).replace(/\./g, '-');

export const preview = (text: string | null | undefined, n = 80) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '……' : t;
};

/** 四角星芒 */
export function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.14;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

let uid = 0;
/** SVG 渐变 / 路径的 id：同一页面上有多枚胶囊、邮戳时不能撞名 */
export const nextId = (prefix: string) => `${prefix}-${++uid}`;
