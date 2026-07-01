// 创建页「AI 推荐主题」灵感条：标签轮换三色描边 + 换一批。纯展示，逻辑在 CreatePage。
// = React RecommendationStrip.tsx。
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';

class RecommendationStrip extends StatelessWidget {
  final List<CapsuleRecommendation> recos;
  final bool busy;
  final bool disabled;
  final ValueChanged<CapsuleRecommendation> onPick;
  final VoidCallback onRefresh;

  const RecommendationStrip({
    super.key,
    required this.recos,
    required this.busy,
    this.disabled = false,
    required this.onPick,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final palettes = [c.brandPrimary, c.accentPrimary, c.signalPrimary];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('✨ 没有头绪？试试这些灵感',
            style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm, fontWeight: AppFont.medium)),
        const Spacer(),
        TextButton(
          onPressed: (busy || disabled) ? null : onRefresh,
          child: Text(busy ? '换一批中…' : '换一批', style: TextStyle(color: c.textLink, fontSize: AppSize.fsSm)),
        ),
      ]),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (var i = 0; i < recos.length; i++)
          Tooltip(
            message: recos[i].hint,
            child: OutlinedButton(
              onPressed: (busy || disabled) ? null : () => onPick(recos[i]),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: palettes[i % palettes.length]),
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
              child: Text(recos[i].title, style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsSm)),
            ),
          ),
      ]),
    ]);
  }
}
