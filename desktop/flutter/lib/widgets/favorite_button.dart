// 收藏按钮（sm 卡片角标 / md 详情按钮）。匿名 → 弹确认跳登录；否则切换并同步广场/收藏。
// = React FavoriteButton.tsx。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../stores/auth.dart';
import '../stores/capsule.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';

enum FavSize { sm, md }

class FavoriteButton extends ConsumerStatefulWidget {
  final String capsuleId;
  final bool favoritedByMe;
  final int favoriteCount;
  final FavSize size;
  final void Function(bool favorited, int count)? onChange;

  const FavoriteButton({
    super.key,
    required this.capsuleId,
    required this.favoritedByMe,
    required this.favoriteCount,
    this.size = FavSize.sm,
    this.onChange,
  });

  @override
  ConsumerState<FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends ConsumerState<FavoriteButton> {
  late bool _active = widget.favoritedByMe;
  late int _count = widget.favoriteCount;
  bool _busy = false;

  @override
  void didUpdateWidget(FavoriteButton old) {
    super.didUpdateWidget(old);
    if (old.capsuleId != widget.capsuleId ||
        old.favoritedByMe != widget.favoritedByMe ||
        old.favoriteCount != widget.favoriteCount) {
      _active = widget.favoritedByMe;
      _count = widget.favoriteCount;
    }
  }

  Future<void> _toggle() async {
    final user = ref.read(authProvider).user;
    if (user == null) {
      final yes = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: const Text('登录后才能收藏，前往登录？'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('去登录')),
          ],
        ),
      );
      if (yes == true && mounted) context.go('/login');
      return;
    }

    setState(() => _busy = true);
    try {
      final newCount = await ref.read(capsuleProvider.notifier).toggleFavorite(widget.capsuleId, _active);
      if (!mounted) return;
      setState(() {
        _active = !_active;
        _count = newCount;
      });
      widget.onChange?.call(_active, _count);
    } catch (_) {
      /* 失败静默，保持原状 */
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final heartColor = _active ? c.favoriteActive : c.favoriteInactive;

    if (widget.size == FavSize.md) {
      return OutlinedButton.icon(
        onPressed: _busy ? null : _toggle,
        icon: Icon(_active ? Icons.favorite : Icons.favorite_border, size: 18, color: heartColor),
        label: Text('收藏 · $_count', style: TextStyle(color: c.textPrimary)),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: c.borderDefault),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSize.radiusMd)),
        ),
      );
    }

    return InkWell(
      onTap: _busy ? null : _toggle,
      borderRadius: BorderRadius.circular(999),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(_active ? Icons.favorite : Icons.favorite_border, size: 15, color: heartColor),
          const SizedBox(width: 4),
          Text('$_count', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
        ]),
      ),
    );
  }
}
