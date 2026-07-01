// 翻页时钟倒计时单元：数字切换用 AnimatedSwitcher 做翻滚过渡。
// = SwiftUI FlipUnit / React CalendarUnit。
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import '../utils/format.dart';

class FlipClock extends StatelessWidget {
  final int days;
  final int hours;
  final int minutes;
  final int seconds;
  final Color accent;
  const FlipClock({
    super.key,
    required this.days,
    required this.hours,
    required this.minutes,
    required this.seconds,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
      _unit(context, days, '天'),
      _sep(context),
      _unit(context, hours, '时'),
      _sep(context),
      _unit(context, minutes, '分'),
      _sep(context),
      _unit(context, seconds, '秒'),
    ]);
  }

  Widget _sep(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 14, left: 6, right: 6),
        child: Text(':', style: TextStyle(color: context.colors.textMuted, fontSize: AppSize.fs3xl, fontWeight: AppFont.bold)),
      );

  Widget _unit(BuildContext context, int value, String label) {
    final c = context.colors;
    final str = pad2(value);
    return Column(children: [
      Container(
        constraints: const BoxConstraints(minWidth: 64),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(AppSize.radiusMd),
          border: Border.all(color: c.borderSubtle),
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 350),
          transitionBuilder: (child, anim) => SlideTransition(
            position: Tween(begin: const Offset(0, -0.4), end: Offset.zero).animate(anim),
            child: FadeTransition(opacity: anim, child: child),
          ),
          child: Text(str,
              key: ValueKey(str),
              textAlign: TextAlign.center,
              style: TextStyle(color: accent, fontSize: AppSize.fs4xl, fontWeight: AppFont.bold, fontFeatures: const [FontFeature.tabularFigures()])),
        ),
      ),
      const SizedBox(height: 8),
      Text(label, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)),
    ]);
  }
}
