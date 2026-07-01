// ============================================================
// 主题层：消费 codegen 的 tokens.dart，组装 ThemeData（明/暗）。
// 语义色经 ThemeExtension<AppColors> 暴露，组件用 context.colors 读取。
// 另含 4 个复合流光渐变（hero CTA / 卡片描边，tokens.json 未含，按 cyber.css 手工组装）。
// = SwiftUI Theme/Tokens.swift 里手补的 gradient* 部分。
// ============================================================

import 'package:flutter/material.dart';
import 'tokens.dart';

/// 复合流光渐变（135deg；值取自 spec/styles/tokens.css，深浅一致）。
class AppGradients {
  AppGradients._();
  static const _begin = Alignment.topLeft;
  static const _end = Alignment.bottomRight;

  /// hero 主 CTA：brand → signal → brand
  static const primaryFlow = LinearGradient(
    begin: _begin, end: _end, colors: [Color(0xFF6B46FF), Color(0xFF14D4F0), Color(0xFF6B46FF)]);

  /// hero 次 CTA：success-solid → opened-accent → success-solid
  static const successFlow = LinearGradient(
    begin: _begin, end: _end, colors: [Color(0xFF1AA866), Color(0xFF5ED49A), Color(0xFF1AA866)]);

  /// 未开启卡片描边：signal → accent → success
  static const cyberFlow = LinearGradient(
    begin: _begin, end: _end, colors: [Color(0xFF14D4F0), Color(0xFFFF2D91), Color(0xFF1AA866)]);

  /// 已开启卡片描边：success → brand → success
  static const mintFlow = LinearGradient(
    begin: _begin, end: _end, colors: [Color(0xFF1AA866), Color(0xFF6B46FF), Color(0xFF1AA866)]);
}

/// 把当前主题的语义色挂到 ThemeData，便于 context.colors 取用。
@immutable
class AppColors extends ThemeExtension<AppColors> {
  final SemanticColors colors;
  const AppColors(this.colors);

  @override
  AppColors copyWith({SemanticColors? colors}) => AppColors(colors ?? this.colors);

  // 主题硬切（无渐变插值），lerp 直接返回目标。
  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) =>
      (other is AppColors) ? other : this;
}

extension AppColorsX on BuildContext {
  SemanticColors get colors => Theme.of(this).extension<AppColors>()!.colors;
}

ThemeData buildAppTheme(SemanticColors c, Brightness brightness) {
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.signalPrimary,
    onPrimary: c.signalOn,
    secondary: c.brandPrimary,
    onSecondary: c.brandOn,
    error: c.dangerSolid,
    onError: Colors.white,
    surface: c.surface1,
    onSurface: c.textPrimary,
  );

  final base = ThemeData(useMaterial3: true, brightness: brightness, colorScheme: scheme);

  return base.copyWith(
    scaffoldBackgroundColor: c.surface0,
    canvasColor: c.surface0,
    extensions: [AppColors(c)],
    textTheme: base.textTheme.apply(
      bodyColor: c.textPrimary,
      displayColor: c.textPrimary,
      fontFamily: AppFont.sans.first,
      fontFamilyFallback: AppFont.sans.skip(1).toList(),
    ),
    dividerColor: c.borderSubtle,
    scrollbarTheme: ScrollbarThemeData(
      thumbColor: WidgetStatePropertyAll(c.borderStrong.withValues(alpha: 0.6)),
    ),
  );
}

ThemeData get darkAppTheme => buildAppTheme(darkColors, Brightness.dark);
ThemeData get lightAppTheme => buildAppTheme(lightColors, Brightness.light);
