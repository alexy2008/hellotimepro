// 我收藏的：列表 + 分页。= React MeFavoritesPage.tsx。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../stores/capsule.dart';
import '../../theme/app_theme.dart';
import '../../theme/components.dart';
import '../../theme/tokens.dart';
import '../../widgets/capsule_grid.dart';
import '../../widgets/pagination.dart';

class MeFavoritesPage extends ConsumerStatefulWidget {
  const MeFavoritesPage({super.key});
  @override
  ConsumerState<MeFavoritesPage> createState() => _MeFavoritesPageState();
}

class _MeFavoritesPageState extends ConsumerState<MeFavoritesPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(capsuleProvider.notifier).fetchFavorites(1));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fav = ref.watch(capsuleProvider).favorites;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('我收藏的胶囊',
          style: TextStyle(
              color: c.textPrimary, fontSize: AppSize.fs2xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
      const SizedBox(height: 8),
      Text('共 ${fav.pagination?.total ?? 0} 条；取消收藏只会从此列表移除，不会影响原胶囊。',
          style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm)),
      const SizedBox(height: 16),
      CapsuleGrid(
        items: fav.items,
        loading: fav.loading,
        emptyHint: Padding(
          padding: const EdgeInsets.symmetric(vertical: 48),
          child: Center(
            child: Column(children: [
              const Text('🗂', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              Text('还没有收藏任何胶囊 —— 去广场看看？',
                  style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
              const SizedBox(height: 12),
              HtButton(label: '去广场', variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => context.go('/')),
            ]),
          ),
        ),
      ),
      Pagination(
        page: fav.page,
        totalPages: fav.pagination?.totalPages ?? 0,
        onChange: (p) => ref.read(capsuleProvider.notifier).fetchFavorites(p),
      ),
    ]);
  }
}
