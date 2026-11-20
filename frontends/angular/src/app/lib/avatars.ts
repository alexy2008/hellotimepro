// ============================================================
// 内置头像：直接读 spec/avatars/v2（单线徽记，currentColor）。
// 构建期用 text 加载器把 SVG 源码内联进来（angular.json 的 loader 配置），
// 所以头像在任何皮肤下都由样式上色，不依赖后端 /static，也不用 <img>。
// ============================================================

import catalog from "@spec/avatars/v2/catalog.json";
import circuit from "@spec/avatars/v2/circuit.svg";
import drift from "@spec/avatars/v2/drift.svg";
import echo from "@spec/avatars/v2/echo.svg";
import glyph from "@spec/avatars/v2/glyph.svg";
import neo from "@spec/avatars/v2/neo.svg";
import nova from "@spec/avatars/v2/nova.svg";
import oracle from "@spec/avatars/v2/oracle.svg";
import pulse from "@spec/avatars/v2/pulse.svg";
import specter from "@spec/avatars/v2/specter.svg";
import voidSvg from "@spec/avatars/v2/void.svg";

const RAW: Record<string, string> = { circuit, drift, echo, glyph, neo, nova, oracle, pulse, specter, void: voidSvg };

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

export const AVATARS: AvatarDef[] = catalog.avatars.map((a) => ({
  id: a.id,
  name: a.name,
  tagline: a.tagline,
  color: a.primaryColor,
  glyph: innerOf(RAW[a.id] ?? ""),
}));

export const avatarOf = (id: string | null | undefined): AvatarDef => AVATARS.find((a) => a.id === id) ?? AVATARS[0];
