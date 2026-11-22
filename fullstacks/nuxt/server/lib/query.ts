import { ERR } from "./errors";

type Query = Record<string, unknown>;

function single(query: Query, field: string) {
  const raw = query[field];
  if (raw !== undefined && typeof raw !== "string") {
    throw ERR.validation(`${field} 必须为单个查询值`, field);
  }
  return raw;
}

export function parsePagination(query: Query) {
  const integer = (field: string, fallback: number, max: number) => {
    const raw = single(query, field);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max) {
      throw ERR.validation(`${field} 必须是范围内的正整数`, field);
    }
    return value;
  };
  return {
    page: integer("page", 1, Number.MAX_SAFE_INTEGER),
    pageSize: integer("pageSize", 20, 50),
  };
}

export function parseSearch(query: Query) {
  const q = single(query, "q")?.trim() ?? "";
  if (Array.from(q).length > 50) throw ERR.validation("q 长度不得超过 50", "q");
  return q;
}

export function parsePlazaQuery(query: Query) {
  const sort = single(query, "sort") ?? "new";
  if (sort !== "hot" && sort !== "new") throw ERR.validation("sort 仅支持 hot/new", "sort");
  const filter = single(query, "filter") ?? "all";
  if (filter !== "all" && filter !== "opened" && filter !== "unopened") {
    throw ERR.validation("filter 仅支持 all/opened/unopened", "filter");
  }
  return { ...parsePagination(query), sort, filter, q: parseSearch(query) } as const;
}
