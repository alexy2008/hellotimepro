import "server-only";
import { ERR } from "./errors";

/** 缺省参数使用契约默认值，显式传入的参数必须是范围内的整数。 */
export function parsePagination(params: URLSearchParams) {
  function integer(field: string, fallback: number, max: number) {
    const raw = params.get(field);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max) {
      throw ERR.validation(`${field} 必须是有效范围内的正整数`, field);
    }
    return value;
  }
  return { page: integer("page", 1, Number.MAX_SAFE_INTEGER), pageSize: integer("pageSize", 20, 50) };
}
