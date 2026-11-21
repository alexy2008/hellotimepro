import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Avatar {
  id: string;
  name: string;
  primaryColor: string;
  svgUrl: string;
}

interface CatalogJson {
  avatars: Array<{ id: string; name: string; primaryColor: string; svgUrl: string }>;
}

let cached: Avatar[] | null = null;

function loadCatalog(): Avatar[] {
  if (cached) return cached;
  // 2.0 单线徽记：spec/avatars/v2（id 与 1.x 相同）
  const path = join(process.cwd(), "..", "..", "spec", "avatars", "v2", "catalog.json");
  const raw = readFileSync(path, "utf8");
  const json = JSON.parse(raw) as CatalogJson;
  cached = json.avatars.map((a) => ({
    id: a.id,
    name: a.name,
    primaryColor: a.primaryColor,
    svgUrl: `/static/avatars/${a.id}.svg`,
  }));
  return cached;
}

export function listAvatars(): Avatar[] {
  return loadCatalog();
}

export function allowedAvatarIds(): Set<string> {
  return new Set(loadCatalog().map((a) => a.id));
}
