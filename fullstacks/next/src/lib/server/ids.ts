/**
 * UUID 与时间的跨库归一（2.0）。
 *
 * - PostgreSQL：原生 uuid / timestamptz（drizzle mode:"string" 读回 `2026-01-01 00:00:00+00`）
 * - SQLite：TEXT。`scripts/db seed` 写入的主键是**无连字符的 32 位十六进制**，
 *   应用新建的是带连字符的标准格式，同一张表里两种并存；时间是 ISO 文本
 *   （种子 `…+00:00`，应用 `toISOString()` 的 `…Z`）。
 *
 * 约定：对外输出一律是带连字符的小写 UUID 与 `toISOString()`；按外部传入的 id 查找时
 * 两种格式都匹配，写外键（收藏、删除）用查到的原始主键。
 */
import "server-only";

import { ERR } from "./errors";

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

/** 路径 / 请求体里的胶囊 id：格式不合法 → 422（与 fastapi 的 uuid.UUID 参数一致）。 */
export function requireUuid(s: string, field: string): string {
  if (!isUuid(s)) throw ERR.validation(`${field} 不是合法的 UUID`, field);
  return s;
}

/** 统一成带连字符的小写形式（输出用）。非 UUID 原样返回。 */
export function dashed(id: string): string {
  if (!isUuid(id)) return id;
  const h = id.replace(/-/g, "").toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 查找用：SQLite 下同时匹配带 / 不带连字符两种存法；PostgreSQL 的 uuid 列只需一种。 */
export function idCandidates(id: string, kind: "postgres" | "sqlite"): string[] {
  const d = dashed(id);
  return kind === "sqlite" ? [d, d.replace(/-/g, "")] : [d];
}

/** 数据库读回的时间 → ISO 8601（UTC）。 */
export function iso(v: string | Date): string {
  return new Date(v).toISOString();
}

/** 往后数若干个日历年的同一时刻（UTC）；目标年没有 2 月 29 日时取 2 月 28 日。 */
export function addCalendarYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  const month = out.getUTCMonth();
  out.setUTCFullYear(out.getUTCFullYear() + years);
  // Date 会把不存在的 2/29 进位成 3/1，显式回退到当月最后一天
  if (out.getUTCMonth() !== month) out.setUTCDate(0);
  return out;
}
