/**
 * 服务端读取 spec/avatars/v2：catalog.json + 每个徽记的 SVG 内层路径。
 * 根布局（Server Component）调用它，把结果作为 props 交给客户端根组件。
 */
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AvatarDef } from "@/lib/avatars";

const DIR = join(process.cwd(), "..", "..", "spec", "avatars", "v2");

interface CatalogJson {
  avatars: Array<{ id: string; name: string; tagline: string; primaryColor: string }>;
}

function innerOf(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .trim();
}

let cached: AvatarDef[] | null = null;

export function avatarCatalog(): AvatarDef[] {
  if (cached) return cached;
  const catalog = JSON.parse(readFileSync(join(DIR, "catalog.json"), "utf8")) as CatalogJson;
  cached = catalog.avatars.map((a) => ({
    id: a.id,
    name: a.name,
    tagline: a.tagline,
    color: a.primaryColor,
    glyph: innerOf(readFileSync(join(DIR, `${a.id}.svg`), "utf8")),
  }));
  return cached;
}
