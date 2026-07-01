// 我创建的：列表（撤回/已开收藏数）+ 分页。= React MeCreatedPage.tsx。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../stores/capsule.dart';
import '../../theme/app_theme.dart';
import '../../theme/components.dart';
import '../../theme/tokens.dart';
import '../../widgets/capsule_grid.dart';
import '../../widgets/pagination.dart';

class MeCreatedPage extends ConsumerStatefulWidget {
  const MeCreatedPage({super.key});
  @override
  ConsumerState<MeCreatedPage> createState() => _MeCreatedPageState();
}

class _MeCreatedPageState extends ConsumerState<MeCreatedPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(capsuleProvider.notifier).fetchMine(1));
  }

  Future<void> _withdraw(String id) async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: const Text('确认撤回？此操作不可恢复。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('撤回')),
        ],
      ),
    );
    if (sure == true) {
      try {
        await ref.read(capsuleProvider.notifier).deleteCapsule(id);
      } catch (_) {/* 静默 */}
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mine = ref.watch(capsuleProvider).mine;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('我创建的胶囊',
          style: TextStyle(
              color: c.textPrimary, fontSize: AppSize.fs2xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
      const SizedBox(height: 12),
      Row(children: [
        Text('按创建时间倒序 · 共 ${mine.pagination?.total ?? 0} 条',
            style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
        const Spacer(),
        HtButton(label: '+ 新建胶囊', variant: HtVariant.primary, size: HtSize.sm, onPressed: () => context.go('/create')),
      ]),
      const SizedBox(height: 16),
      CapsuleGrid(
        items: mine.items,
        loading: mine.loading,
        showCreator: false,
        hideFavorite: true,
        emptyHint: _empty(context),
        cardSlot: (cap) => cap.isOpened
            ? Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.favorite, size: 14, color: c.favoriteActive),
                const SizedBox(width: 4),
                Text('${cap.favoriteCount}', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
              ])
            : HtButton(label: '撤回', variant: HtVariant.danger, size: HtSize.sm, onPressed: () => _withdraw(cap.id)),
      ),
      Pagination(
        page: mine.page,
        totalPages: mine.pagination?.totalPages ?? 0,
        onChange: (p) => ref.read(capsuleProvider.notifier).fetchMine(p),
      ),
    ]);
  }

  Widget _empty(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Column(children: [
          const Text('📭', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text('还没有创建任何胶囊', style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
          const SizedBox(height: 12),
          HtButton(label: '去创建一个', variant: HtVariant.primary, size: HtSize.sm, onPressed: () => context.go('/create')),
        ]),
      ),
    );
  }
}
