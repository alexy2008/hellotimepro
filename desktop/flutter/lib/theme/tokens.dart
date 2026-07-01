// ============================================================
// 自动生成 · 请勿手改 (AUTO-GENERATED — DO NOT EDIT)
//
// 由 scripts/gen-tokens-flutter 从 spec/tokens/tokens.json 生成。
// 重新生成：node scripts/gen-tokens-flutter
// 源（事实源）：spec/styles/tokens.css → spec/tokens/tokens.json
//
// rem 已折算为 px double（1rem=16px）；颜色→Color、渐变→LinearGradient、
// 辉光→Color + <名>Blur。消费入口见 lib/theme/app_theme.dart。
// ============================================================

import 'package:flutter/material.dart';

/// 间距 / 圆角 / 字号 / 布局（主题无关 px 常量）。
class AppSize {
  AppSize._();
  static const double s0 = 0;
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s8 = 32;
  static const double s10 = 40;
  static const double s12 = 48;
  static const double s16 = 64;
  static const double s20 = 80;

  static const double radiusXs = 2;
  static const double radiusSm = 4;
  static const double radiusMd = 8;
  static const double radiusLg = 12;
  static const double radiusXl = 16;
  static const double radius2xl = 24;
  static const double radiusFull = 9999;

  static const double fsXs = 12;
  static const double fsSm = 14;
  static const double fsBase = 16;
  static const double fsLg = 18;
  static const double fsXl = 20;
  static const double fs2xl = 24;
  static const double fs3xl = 30;
  static const double fs4xl = 36;
  static const double fs5xl = 48;

  static const double containerMax = 1200;
  static const double containerNarrow = 720;
  static const double headerHeight = 64;
  static const double footerHeight = 64;
}

/// 字体族（fallback 列表）与字重。
class AppFont {
  AppFont._();
  static const List<String> sans = ["Inter", "HarmonyOS Sans SC", "PingFang SC", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Noto Sans CJK SC", "sans-serif"];
  static const List<String> mono = ["JetBrains Mono", "Fira Code", "SF Mono", "Menlo", "Consolas", "monospace"];
  static const List<String> display = ["Orbitron", "Exo 2", "Inter", "HarmonyOS Sans SC", "PingFang SC", "sans-serif"];

  static const FontWeight regular = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;
}

/// 语义色板（每主题一套；字段由 codegen 生成）。
@immutable
class SemanticColors {
  final Color surface0;
  final Color surface1;
  final Color surface2;
  final Color surface3;
  final Color surfaceRaised;
  final Color surfaceOverlay;
  final Color borderSubtle;
  final Color borderDefault;
  final Color borderStrong;
  final Color borderFocus;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDisabled;
  final Color textInverse;
  final Color textLink;
  final Color textLinkHover;
  final Color brandPrimary;
  final Color brandHover;
  final Color brandPressed;
  final Color brandSubtle;
  final Color brandOn;
  final Color accentPrimary;
  final Color accentHover;
  final Color accentSubtle;
  final Color accentOn;
  final Color signalPrimary;
  final Color signalHover;
  final Color signalSubtle;
  final Color signalOn;
  final Color successBg;
  final Color successFg;
  final Color successBorder;
  final Color successSolid;
  final Color successOn;
  final Color warningBg;
  final Color warningFg;
  final Color warningBorder;
  final Color warningSolid;
  final Color dangerBg;
  final Color dangerFg;
  final Color dangerBorder;
  final Color dangerSolid;
  final Color plazaCardBg;
  final Color plazaCardHover;
  final Color plazaCardBorder;
  final Color plazaDivider;
  final Color plazaGlow;
  final Color capsuleSealedBorder;
  final Color capsuleSealedAccent;
  final Color capsuleSealedGlow;
  final double capsuleSealedGlowBlur;
  final Color capsuleOpenedSubtle;
  final Color capsuleOpenedBorder;
  final Color capsuleOpenedAccent;
  final Color capsuleOpenedGlow;
  final double capsuleOpenedGlowBlur;
  final Color favoriteActive;
  final Color favoriteInactive;
  final LinearGradient gradientBrandHero;
  final LinearGradient gradientBrandSubtle;

  const SemanticColors({
    required this.surface0,
    required this.surface1,
    required this.surface2,
    required this.surface3,
    required this.surfaceRaised,
    required this.surfaceOverlay,
    required this.borderSubtle,
    required this.borderDefault,
    required this.borderStrong,
    required this.borderFocus,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.textInverse,
    required this.textLink,
    required this.textLinkHover,
    required this.brandPrimary,
    required this.brandHover,
    required this.brandPressed,
    required this.brandSubtle,
    required this.brandOn,
    required this.accentPrimary,
    required this.accentHover,
    required this.accentSubtle,
    required this.accentOn,
    required this.signalPrimary,
    required this.signalHover,
    required this.signalSubtle,
    required this.signalOn,
    required this.successBg,
    required this.successFg,
    required this.successBorder,
    required this.successSolid,
    required this.successOn,
    required this.warningBg,
    required this.warningFg,
    required this.warningBorder,
    required this.warningSolid,
    required this.dangerBg,
    required this.dangerFg,
    required this.dangerBorder,
    required this.dangerSolid,
    required this.plazaCardBg,
    required this.plazaCardHover,
    required this.plazaCardBorder,
    required this.plazaDivider,
    required this.plazaGlow,
    required this.capsuleSealedBorder,
    required this.capsuleSealedAccent,
    required this.capsuleSealedGlow,
    required this.capsuleSealedGlowBlur,
    required this.capsuleOpenedSubtle,
    required this.capsuleOpenedBorder,
    required this.capsuleOpenedAccent,
    required this.capsuleOpenedGlow,
    required this.capsuleOpenedGlowBlur,
    required this.favoriteActive,
    required this.favoriteInactive,
    required this.gradientBrandHero,
    required this.gradientBrandSubtle,
  });
}

const SemanticColors darkColors = SemanticColors(
    surface0: Color(0xFF06060C),
    surface1: Color(0xFF0D0D15),
    surface2: Color(0xFF181824),
    surface3: Color(0xFF262635),
    surfaceRaised: Color(0xFF181824),
    surfaceOverlay: Color.fromRGBO(6, 6, 12, 0.72),
    borderSubtle: Color(0xFF262635),
    borderDefault: Color(0xFF3A3A4D),
    borderStrong: Color(0xFF55556A),
    borderFocus: Color(0xFF8467FF),
    textPrimary: Color(0xFFF7F7FB),
    textSecondary: Color(0xFFD7D7E2),
    textMuted: Color(0xFF80808F),
    textDisabled: Color(0xFF55556A),
    textInverse: Color(0xFF0D0D15),
    textLink: Color(0xFF40E4FF),
    textLinkHover: Color(0xFF80EFFF),
    brandPrimary: Color(0xFF6B46FF),
    brandHover: Color(0xFF8467FF),
    brandPressed: Color(0xFF5A34EE),
    brandSubtle: Color(0xFF341A8F),
    brandOn: Color(0xFFF7F7FB),
    accentPrimary: Color(0xFFFF2D91),
    accentHover: Color(0xFFFF4FA0),
    accentSubtle: Color(0xFF7E0844),
    accentOn: Color(0xFFF7F7FB),
    signalPrimary: Color(0xFF14D4F0),
    signalHover: Color(0xFF40E4FF),
    signalSubtle: Color(0xFF004B59),
    signalOn: Color(0xFF06060C),
    successBg: Color(0xFF08402A),
    successFg: Color(0xFF5ED49A),
    successBorder: Color(0xFF0F6B41),
    successSolid: Color(0xFF1AA866),
    successOn: Color(0xFF06060C),
    warningBg: Color(0xFF5A3700),
    warningFg: Color(0xFFFFC14A),
    warningBorder: Color(0xFFA46400),
    warningSolid: Color(0xFFF29D0A),
    dangerBg: Color(0xFF4A1A1A),
    dangerFg: Color(0xFFD47A7A),
    dangerBorder: Color(0xFF8A2E2E),
    dangerSolid: Color(0xFFB84040),
    plazaCardBg: Color(0xFF0D0D15),
    plazaCardHover: Color(0xFF181824),
    plazaCardBorder: Color(0xFF262635),
    plazaDivider: Color(0xFF181824),
    plazaGlow: Color.fromRGBO(107, 70, 255, 0.35),
    capsuleSealedBorder: Color(0xFF00B8D4),
    capsuleSealedAccent: Color(0xFF40E4FF),
    capsuleSealedGlow: Color.fromRGBO(20, 212, 240, 0.45),
    capsuleSealedGlowBlur: 24,
    capsuleOpenedSubtle: Color(0xFF08402A),
    capsuleOpenedBorder: Color(0xFF1AA866),
    capsuleOpenedAccent: Color(0xFF5ED49A),
    capsuleOpenedGlow: Color.fromRGBO(94, 212, 154, 0.38),
    capsuleOpenedGlowBlur: 18,
    favoriteActive: Color(0xFFFF2D91),
    favoriteInactive: Color(0xFF80808F),
    gradientBrandHero: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF40E4FF), Color(0xFFFF4FA0), Color(0xFF5ED49A)], stops: [0, 0.5, 1]),
    gradientBrandSubtle: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(20, 212, 240, 0.15), Color.fromRGBO(255, 79, 160, 0.10), Color.fromRGBO(94, 212, 154, 0.08)]),
);

const SemanticColors lightColors = SemanticColors(
    surface0: Color(0xFFF7F7FB),
    surface1: Color(0xFFFFFFFF),
    surface2: Color(0xFFEEEEF4),
    surface3: Color(0xFFD7D7E2),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceOverlay: Color.fromRGBO(13, 13, 21, 0.48),
    borderSubtle: Color(0xFFD7D7E2),
    borderDefault: Color(0xFFB0B0C0),
    borderStrong: Color(0xFF80808F),
    borderFocus: Color(0xFF6B46FF),
    textPrimary: Color(0xFF0D0D15),
    textSecondary: Color(0xFF262635),
    textMuted: Color(0xFF55556A),
    textDisabled: Color(0xFF80808F),
    textInverse: Color(0xFFF7F7FB),
    textLink: Color(0xFF5A34EE),
    textLinkHover: Color(0xFF6B46FF),
    brandPrimary: Color(0xFF5A34EE),
    brandHover: Color(0xFF6B46FF),
    brandPressed: Color(0xFF4824C4),
    brandSubtle: Color(0xFFE4DCFF),
    brandOn: Color(0xFFFFFFFF),
    accentPrimary: Color(0xFFE01778),
    accentHover: Color(0xFFFF2D91),
    accentSubtle: Color(0xFFFFD9EC),
    accentOn: Color(0xFFFFFFFF),
    signalPrimary: Color(0xFF0090A8),
    signalHover: Color(0xFF00B8D4),
    signalSubtle: Color(0xFFBFF7FF),
    signalOn: Color(0xFFFFFFFF),
    successBg: Color(0xFFE8FBF1),
    successFg: Color(0xFF0F6B41),
    successBorder: Color(0xFF5ED49A),
    successSolid: Color(0xFF1AA866),
    successOn: Color(0xFFFFFFFF),
    warningBg: Color(0xFFFFF5E0),
    warningFg: Color(0xFFA46400),
    warningBorder: Color(0xFFFFC14A),
    warningSolid: Color(0xFFF29D0A),
    dangerBg: Color(0xFFFDF0F0),
    dangerFg: Color(0xFF8A2E2E),
    dangerBorder: Color(0xFFD47A7A),
    dangerSolid: Color(0xFFB84040),
    plazaCardBg: Color(0xFFFFFFFF),
    plazaCardHover: Color(0xFFF7F7FB),
    plazaCardBorder: Color(0xFFD7D7E2),
    plazaDivider: Color(0xFFEEEEF4),
    plazaGlow: Color.fromRGBO(107, 70, 255, 0.18),
    capsuleSealedBorder: Color(0xFF00B8D4),
    capsuleSealedAccent: Color(0xFF006D80),
    capsuleSealedGlow: Color.fromRGBO(0, 184, 212, 0.22),
    capsuleSealedGlowBlur: 18,
    capsuleOpenedSubtle: Color(0xFFC2F2D8),
    capsuleOpenedBorder: Color(0xFF1AA866),
    capsuleOpenedAccent: Color(0xFF0F6B41),
    capsuleOpenedGlow: Color.fromRGBO(94, 212, 154, 0.20),
    capsuleOpenedGlowBlur: 12,
    favoriteActive: Color(0xFFFF2D91),
    favoriteInactive: Color(0xFF80808F),
    gradientBrandHero: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF14D4F0), Color(0xFFFF2D91), Color(0xFF1AA866)], stops: [0, 0.5, 1]),
    gradientBrandSubtle: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(20, 212, 240, 0.10), Color.fromRGBO(255, 45, 145, 0.07), Color.fromRGBO(26, 168, 102, 0.06)]),
);
