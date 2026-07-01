// 胶囊卡片：渐变描边 + 状态辉光 + hover 上浮呼吸；未开启每秒倒计时。
// = React CapsuleCard.tsx / SwiftUI CapsuleCard.swift。
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import '../utils/format.dart';
import 'favorite_button.dart';
import 'remote_svg.dart';

class CapsuleCard extends StatefulWidget {
  final CapsuleListItem capsule;
  final bool showCreator;
  final bool hideFavorite;
  final Widget? rightSlot; // me-created 列表替换为撤回按钮

  const CapsuleCard({
    super.key,
    required this.capsule,
    this.showCreator = true,
    this.hideFavorite = false,
    this.rightSlot,
  });

  @override
  State<CapsuleCard> createState() => _CapsuleCardState();
}

class _CapsuleCardState extends State<CapsuleCard> with SingleTickerProviderStateMixin {
  Timer? _ticker;
  bool _hover = false;
  late AnimationController _breath;

  bool get _opened => widget.capsule.isOpened;

  @override
  void initState() {
    super.initState();
    _breath = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
    if (!_opened) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _breath.dispose();
    super.dispose();
  }

  void _setHover(bool h) {
    setState(() => _hover = h);
    if (h) {
      _breath.repeat(reverse: true);
    } else {
      _breath.stop();
      _breath.animateTo(0, duration: const Duration(milliseconds: 250));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final cap = widget.capsule;
    final gradient = _opened ? AppGradients.mintFlow : AppGradients.cyberFlow;
    final glow = _opened ? c.capsuleOpenedGlow : c.capsuleSealedGlow;
    final accent = _opened ? c.capsuleOpenedAccent : c.capsuleSealedAccent;
    final cd = countdownToIso(cap.openAt);

    return MouseRegion(
      onEnter: (_) => _setHover(true),
      onExit: (_) => _setHover(false),
      child: AnimatedBuilder(
        animation: _breath,
        builder: (context, child) {
          final scale = 1 + _breath.value * 0.015;
          return Transform.translate(
            offset: Offset(0, _hover ? -2 : 0),
            child: Transform.scale(scale: scale, child: child),
          );
        },
        // 用普通 Container：AnimatedContainer 会对自定义 GradientBoxBorder 做 BoxBorder.lerp 而抛错；
        // hover 的上浮/呼吸由外层 Transform 动画驱动，描边与辉光随 setState 即时切换即可。
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: c.surface1,
            borderRadius: BorderRadius.circular(AppSize.radiusLg),
            border: GradientBoxBorder(gradient: gradient, width: 1.5),
            boxShadow: [BoxShadow(color: glow.withValues(alpha: _hover ? 1 : 0.7), blurRadius: _hover ? 22 : 10)],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            // head：徽章 + 码
            Row(children: [
              _badge(context, _opened ? '已开启' : '未开启', accent),
              const Spacer(),
              InkWell(
                onTap: () => context.go('/c/${cap.code}'),
                child: Text(cap.code,
                    style: TextStyle(color: c.textLink, fontSize: AppSize.fsSm, fontWeight: AppFont.semibold)),
              ),
            ]),
            const SizedBox(height: 12),
            // 标题
            InkWell(
              onTap: () => context.go('/c/${cap.code}'),
              child: Text(cap.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsLg, fontWeight: AppFont.semibold)),
            ),
            const SizedBox(height: 12),
            if (!_opened)
              Text(
                '⏳ 还剩 ${cd.days} 天 · ${pad2(cd.hours)}:${pad2(cd.minutes)}:${pad2(cd.seconds)}',
                style: TextStyle(color: accent, fontSize: AppSize.fsSm, fontWeight: AppFont.medium),
              )
            else if (cap.contentPreview != null && cap.contentPreview!.isNotEmpty)
              Text(cap.contentPreview!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm, height: 1.4)),
            const SizedBox(height: 16),
            // meta
            Row(children: [
              if (widget.showCreator)
                Expanded(
                  child: Row(children: [
                    AvatarView(avatarId: cap.creator.avatarId, nickname: cap.creator.nickname, size: 22),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(cap.creator.nickname,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm)),
                    ),
                  ]),
                )
              else
                Expanded(
                  child: Text('创建于 ${fmtDate(cap.createdAt)}',
                      style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                ),
              if (widget.rightSlot != null)
                widget.rightSlot!
              else if (!widget.hideFavorite)
                FavoriteButton(
                    capsuleId: cap.id, favoritedByMe: cap.favoritedByMe, favoriteCount: cap.favoriteCount),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _badge(BuildContext context, String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: color, fontSize: AppSize.fsXs, fontWeight: AppFont.semibold)),
      );
}

/// 渐变描边（Flutter 无内建 gradient border，自绘）。
class GradientBoxBorder extends BoxBorder {
  final Gradient gradient;
  final double width;
  const GradientBoxBorder({required this.gradient, this.width = 1});

  @override
  BorderSide get bottom => BorderSide.none;
  @override
  BorderSide get top => BorderSide.none;
  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(width);
  @override
  bool get isUniform => true;

  @override
  void paint(Canvas canvas, Rect rect,
      {TextDirection? textDirection, BoxShape shape = BoxShape.rectangle, BorderRadius? borderRadius}) {
    final paint = Paint()
      ..strokeWidth = width
      ..style = PaintingStyle.stroke
      ..shader = gradient.createShader(rect);
    final rrect = (borderRadius ?? BorderRadius.zero).toRRect(rect).deflate(width / 2);
    canvas.drawRRect(rrect, paint);
  }

  @override
  ShapeBorder scale(double t) => GradientBoxBorder(gradient: gradient, width: width * t);
}
