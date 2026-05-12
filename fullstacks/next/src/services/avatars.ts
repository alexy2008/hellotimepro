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
  const path = join(process.cwd(), "..", "..", "spec", "avatars", "catalog.json");
  const raw = readFileSync(path, "utf8");
  const json = JSON.parse(raw) as CatalogJson;
  cached = json.avatars.map((a) => ({
    id: a.id,
    name: a.name,
    primaryColor: a.primaryColor,
    svgUrl: a.svgUrl,
  }));
  return cached;
}

export function listAvatars(): Avatar[] {
  return loadCatalog();
}

export function allowedAvatarIds(): Set<string> {
  return new Set(loadCatalog().map((a) => a.id));
}
