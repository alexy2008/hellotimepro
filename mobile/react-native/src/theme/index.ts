// ============================================================
// 主题消费层：把 codegen 生成的 tokens.ts 转成 RN 组件好用的形态。
//
// - 颜色调色板：usePalette() 跟随明/暗主题（store 在 @/stores/theme）
// - 间距 / 圆角 / 字号 / 字重：主题无关，直接从 tokens 取（已是 px 数字）
// - 字体：Orbitron（display）+ Inter（body），在根布局 useFonts 加载
// - glow()：把霓虹辉光语义转成 RN 的 shadow* / elevation
// - extractGradientColors()：把 tokens 里的 CSS 渐变字符串解析成色组，喂 expo-linear-gradient
// ============================================================

import { Platform, type ViewStyle } from "react-native";
import { tokens, type ThemeMode } from "./tokens";
import { useTheme } from "@/stores/theme";

export { tokens };
export type { ThemeMode };

// ---- 主题无关令牌（px 数字，可直接用于 style） ----
export const space = tokens.space;
export const radius = tokens.radius;
export const fontSize = tokens.typography.fontSize;
export const lineHeight = tokens.typography.lineHeight;
export const fontWeight = tokens.typography.fontWeight;
export const shadowTokens = tokens.shadow;

// ---- 字体族（与根布局 useFonts 加载的 key 对应） ----
export const fonts = {
  display: "Orbitron_700Bold",
  displayMedium: "Orbitron_500Medium",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemibold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })!,
} as const;

export type Palette = (typeof tokens)["semantic"][ThemeMode];

/** 当前主题调色板（dark / light），跟随 theme store。 */
export function usePalette(): Palette {
  const mode = useTheme((s) => s.mode);
  return tokens.semantic[mode];
}

/** 非 hook 场景下取调色板。 */
export function paletteFor(mode: ThemeMode): Palette {
  return tokens.semantic[mode];
}

// ---- 霓虹辉光 → RN 阴影 ----
// CSS 的多层 box-shadow 辉光在 RN 无对应；用 shadowColor + 大 shadowRadius + 无偏移近似。
// iOS 走 shadow*，Android 只有 elevation（无颜色辉光，退化为普通投影）。
export function glow(
  color: string,
  opts: { radius?: number; opacity?: number; elevation?: number } = {},
): ViewStyle {
  const radius = opts.radius ?? 24;
  return {
    shadowColor: color,
    shadowOpacity: opts.opacity ?? 0.45,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: opts.elevation ?? Math.round(radius / 2),
  };
}

// ---- 普通投影（深度阴影，非辉光） ----
export const elevation = {
  sm: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  md: { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  lg: { shadowColor: "#000", shadowOpacity: 0.38, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} satisfies Record<string, ViewStyle>;

// ---- CSS 渐变 → 色组（喂 expo-linear-gradient 的 colors 数组） ----
const HEX_OR_RGBA = /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g;

/** 从 "linear-gradient(135deg, #aaa 0%, #bbb 100%)" 抽出 ["#aaa","#bbb"]。 */
export function extractGradientColors(cssGradient: string): string[] {
  const matches = cssGradient.match(HEX_OR_RGBA);
  return matches ?? [];
}

/** 品牌 hero 渐变色组（随主题）。 */
export function brandHeroColors(mode: ThemeMode): string[] {
  return extractGradientColors(tokens.semantic[mode].gradient.brandHero);
}

// 斜向渐变（135deg ≈ 左上→右下）的方向向量，供 LinearGradient start/end 复用。
export const diagonal = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
export const horizontal = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as const;
