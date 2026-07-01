// ============================================================
// 共享组件样式：按钮（变体 × 尺寸）、卡片装饰、输入框装饰、Alert、字段标签。
// 对齐 spec/styles/cyber.css 的 cy-btn / cy-card / cy-alert 等。
// primary = 信号青；success = 薄荷绿；ghost = 描边；hero* = 流光渐变 + 辉光。
// 紫色(brand) 不作主按钮色，仅用于标题/品牌点缀。
// ============================================================

import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'tokens.dart';

enum HtVariant { primary, ghost, success, danger, heroPrimary, heroSuccess }

enum HtSize { sm, md, lg }

class HtButton extends StatefulWidget {
  final String? label;
  final IconData? icon;
  final Widget? child;
  final VoidCallback? onPressed;
  final HtVariant variant;
  final HtSize size;
  final bool fullWidth;
  final bool loading;

  const HtButton({
    super.key,
    this.label,
    this.icon,
    this.child,
    required this.onPressed,
    this.variant = HtVariant.primary,
    this.size = HtSize.md,
    this.fullWidth = false,
    this.loading = false,
  });

  @override
  State<HtButton> createState() => _HtButtonState();
}

class _HtButtonState extends State<HtButton> {
  bool _hover = false;

  bool get _hero => widget.variant == HtVariant.heroPrimary || widget.variant == HtVariant.heroSuccess;
  bool get _enabled => widget.onPressed != null && !widget.loading;

  EdgeInsets get _pad {
    if (_hero) return const EdgeInsets.symmetric(vertical: 16, horizontal: 32);
    switch (widget.size) {
      case HtSize.sm:
        return const EdgeInsets.symmetric(vertical: 6, horizontal: 12);
      case HtSize.md:
        return const EdgeInsets.symmetric(vertical: 10, horizontal: 18);
      case HtSize.lg:
        return const EdgeInsets.symmetric(vertical: 14, horizontal: 24);
    }
  }

  double get _fontSize {
    if (_hero) return AppSize.fsLg;
    switch (widget.size) {
      case HtSize.sm:
        return AppSize.fsSm;
      case HtSize.md:
        return AppSize.fsBase;
      case HtSize.lg:
        return AppSize.fsLg;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Color fg;
    Gradient? gradient;
    Color? bg;
    Color? glow;
    BoxBorder? border;

    switch (widget.variant) {
      case HtVariant.primary:
        fg = c.signalOn;
        bg = _hover ? c.signalHover : c.signalPrimary;
        glow = c.signalPrimary.withValues(alpha: 0.45);
      case HtVariant.success:
        fg = c.successOn;
        bg = c.successSolid.withValues(alpha: _hover ? 0.85 : 1);
        glow = c.successFg.withValues(alpha: 0.45);
      case HtVariant.ghost:
        fg = c.textPrimary;
        bg = _hover ? c.surface2 : Colors.transparent;
        border = Border.all(color: c.borderDefault);
      case HtVariant.danger:
        fg = c.dangerFg;
        bg = _hover ? c.dangerBg : Colors.transparent;
      case HtVariant.heroPrimary:
        fg = Colors.white;
        gradient = AppGradients.primaryFlow;
        glow = c.signalPrimary.withValues(alpha: 0.45);
      case HtVariant.heroSuccess:
        fg = Colors.white;
        gradient = AppGradients.successFlow;
        glow = c.successFg.withValues(alpha: 0.45);
    }

    final radius = BorderRadius.circular(_hero ? 999 : AppSize.radiusMd);
    final content = Row(
      mainAxisSize: widget.fullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading) ...[
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: fg)),
          const SizedBox(width: 8),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon, size: _fontSize + 2, color: fg),
          const SizedBox(width: 6),
        ],
        if (widget.child != null)
          DefaultTextStyle.merge(
            style: TextStyle(color: fg, fontSize: _fontSize, fontWeight: _hero ? AppFont.bold : AppFont.semibold),
            child: IconTheme.merge(data: IconThemeData(color: fg), child: widget.child!),
          )
        else if (widget.label != null)
          Text(widget.label!,
              style: TextStyle(color: fg, fontSize: _fontSize, fontWeight: _hero ? AppFont.bold : AppFont.semibold)),
      ],
    );

    return MouseRegion(
      cursor: _enabled ? SystemMouseCursors.click : SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: Opacity(
        opacity: _enabled ? 1 : 0.5,
        child: GestureDetector(
          onTap: _enabled ? widget.onPressed : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            width: widget.fullWidth ? double.infinity : null,
            padding: _pad,
            decoration: BoxDecoration(
              color: bg,
              gradient: gradient,
              borderRadius: radius,
              border: border,
              boxShadow: glow != null
                  ? [BoxShadow(color: glow, blurRadius: _hover ? 18 : 12, spreadRadius: _hover ? 1 : 0)]
                  : null,
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}

/// 卡片装饰（= cy-card）。
BoxDecoration cardDecoration(BuildContext context, {Color? border}) {
  final c = context.colors;
  return BoxDecoration(
    color: c.surface1,
    borderRadius: BorderRadius.circular(AppSize.radiusLg),
    border: Border.all(color: border ?? c.borderSubtle),
  );
}

/// 输入框装饰（= fieldStyle / cy 输入）。
InputDecoration htInputDecoration(BuildContext context, {String? hint, Widget? suffix}) {
  final c = context.colors;
  OutlineInputBorder b(Color col) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSize.radiusMd),
        borderSide: BorderSide(color: col),
      );
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: c.surface3,
    hintText: hint,
    hintStyle: TextStyle(color: c.textDisabled),
    suffixIcon: suffix,
    contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
    enabledBorder: b(c.borderDefault),
    focusedBorder: b(c.signalPrimary),
    border: b(c.borderDefault),
  );
}

class FieldLabel extends StatelessWidget {
  final String text;
  final String? hint;
  const FieldLabel(this.text, {super.key, this.hint});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Text(text, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm, fontWeight: AppFont.medium)),
        if (hint != null) ...[
          const SizedBox(width: 6),
          Text(hint!, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
        ],
      ]),
    );
  }
}

enum AlertVariant { info, success, danger }

class HtAlert extends StatelessWidget {
  final AlertVariant variant;
  final String text;
  const HtAlert({super.key, this.variant = AlertVariant.info, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    late final Color fg, bg;
    late final IconData icon;
    switch (variant) {
      case AlertVariant.info:
        fg = c.textLink;
        bg = c.brandSubtle;
        icon = Icons.info_outline;
      case AlertVariant.success:
        fg = c.successFg;
        bg = c.successBg;
        icon = Icons.check_circle_outline;
      case AlertVariant.danger:
        fg = c.dangerFg;
        bg = c.dangerBg;
        icon = Icons.warning_amber_rounded;
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppSize.radiusMd),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: fg),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm, height: 1.4))),
      ]),
    );
  }
}
