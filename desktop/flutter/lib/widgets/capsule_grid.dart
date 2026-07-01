// 胶囊网格：响应式列数（宽屏 3 / 中 2 / 窄 1），加载与空态。
// = React CapsuleGrid.tsx（cy-grid auto-fill）。
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import 'capsule_card.dart';

class CapsuleGrid extends StatelessWidget {
  final List<CapsuleListItem> items;
  final bool loading;
  final Widget? emptyHint;
  final bool showCreator;
  final bool hideFavorite;
  final Widget Function(CapsuleListItem)? cardSlot;

  const CapsuleGrid({
    super.key,
    required this.items,
    this.loading = false,
    this.emptyHint,
    this.showCreator = true,
    this.hideFavorite = false,
    this.cardSlot,
  });

  @override
  Widget build(BuildContext context) {
    if (loading && items.isEmpty) return _empty(context, '⏳', '加载中…');
    if (!loading && items.isEmpty) return emptyHint ?? _empty(context, '🌌', '暂无数据');

    return LayoutBuilder(builder: (context, constraints) {
      final w = constraints.maxWidth;
      final cols = w >= 980 ? 3 : (w >= 640 ? 2 : 1);
      const gap = 16.0;
      final cardW = (w - gap * (cols - 1)) / cols;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          for (final c in items)
            SizedBox(
              width: cardW,
              child: CapsuleCard(
                capsule: c,
                showCreator: showCreator,
                hideFavorite: hideFavorite,
                rightSlot: cardSlot?.call(c),
              ),
            ),
        ],
      );
    });
  }

  Widget _empty(BuildContext context, String emoji, String text) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64),
      child: Center(
        child: Column(children: [
          Text(emoji, style: const TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text(text, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
        ]),
      ),
    );
  }
}
