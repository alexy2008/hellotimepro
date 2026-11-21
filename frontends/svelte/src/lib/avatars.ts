// ============================================================
// 内置头像：直接读 spec/avatars/v2（单线徽记，currentColor）。
// 构建期把 SVG 内联进来，所以头像在任何皮肤下都由样式上色，
// 不依赖后端 /static，也不用 <img>（<img> 里的 currentColor 只会是黑色）。
// ============================================================

import catalog from "@spec/avatars/v2/catalog.json";

const raw = import.meta.glob("../../../../spec/avatars/v2/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface AvatarDef {
  id: string;
  name: string;
  tagline: string;
  color: string;
  /** 徽记的内层路径（不含外层 <svg> 与 <title>） */
  glyph: string;
}

function innerOf(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .trim();
}

const byFile = Object.fromEntries(
  Object.entries(raw).map(([path, svg]) => [path.split("/").pop()!.replace(".svg", ""), innerOf(svg)]),
);

export const AVATARS: AvatarDef[] = catalog.avatars.map((a) => ({
  id: a.id,
  name: a.name,
  tagline: a.tagline,
  color: a.primaryColor,
  glyph: byFile[a.id] ?? "",
}));

export const avatarOf = (id: string | null | undefined): AvatarDef =>
  AVATARS.find((a) => a.id === id) ?? AVATARS[0];
