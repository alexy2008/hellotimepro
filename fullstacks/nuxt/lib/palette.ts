// ============================================================
// 胶囊专属色（琥珀）：由胶囊码确定性算出，算法见 docs/02-design.md §9.6。
// OKLCH 固定亮度与彩度、只变色相，任何色相看上去一样鲜亮。
// 这是「由数据算出的颜色」，是组件层不写色值规则的唯一例外。
// ============================================================

export interface CapsulePalette {
  hue: number;
  capLight: string;
  capDeep: string;
  accent: string;
  glow: string;
}

/** FNV-1a 32 位：初值 0x811c9dc5，按 UTF-16 码元逐个异或再乘 0x01000193 */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function fromHue(hue: number, hue2: number): CapsulePalette {
  return {
    hue,
    capLight: `oklch(0.84 0.14 ${hue})`,
    capDeep: `oklch(0.63 0.19 ${hue})`,
    accent: `oklch(0.78 0.13 ${hue2})`,
    glow: `oklch(0.72 0.17 ${hue} / 0.34)`,
  };
}

export const BRAND_PALETTE = fromHue(68, 300);

export function paletteOf(code: string | null | undefined): CapsulePalette {
  if (!code) return BRAND_PALETTE;
  const h = fnv1a(code);
  const hue = h % 360;
  return fromHue(hue, (hue + 40 + ((h >>> 9) % 41)) % 360);
}
