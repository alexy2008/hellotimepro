import { ERR } from "./errors";

const UUID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

export function dashed(id: string): string {
  const compact = id.replace(/-/g, "").toLowerCase();
  return compact.replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
}

export function capsuleIds(id: string, kind: "sqlite" | "postgres", field: string) {
  if (!UUID.test(id)) throw ERR.validation(`${field} 不是合法的 UUID`, field);
  const canonical = dashed(id);
  return kind === "sqlite" ? [canonical, canonical.replace(/-/g, "")] : [canonical];
}

export const iso = (value: string | Date) => new Date(value).toISOString();
