import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Avatar {
  id: string;
  name: string;
  primaryColor: string;
  svgUrl: string;
}

let cached: Avatar[] | null = null;

export function listAvatars() {
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "..", "..", "spec", "avatars", "catalog.json"), "utf8");
  const json = JSON.parse(raw) as { avatars: Avatar[] };
  cached = json.avatars;
  return cached;
}

export function allowedAvatarIds() {
  return new Set(listAvatars().map((a) => a.id));
}
