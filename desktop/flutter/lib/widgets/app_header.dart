// 顶部导航：品牌 logo + 广场/开启/关于 + 主题切换 + 用户菜单（或登录/注册）。
// = React AppHeader.tsx / SwiftUI AppHeader.swift。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../stores/auth.dart';
import '../stores/theme.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import 'remote_svg.dart';

class AppHeader extends ConsumerWidget {
  const AppHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final user = ref.watch(authProvider).user;
    final loc = GoRouterState.of(context).matchedLocation;

    return Container(
      height: AppSize.headerHeight,
      decoration: BoxDecoration(
        color: c.surface0,
        border: Border(bottom: BorderSide(color: c.borderSubtle)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: AppSize.containerMax),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                _brand(context),
                const SizedBox(width: 24),
                _navLink(context, '广场', '/', loc == '/'),
                _navLink(context, '开启', '/open', loc == '/open'),
                _navLink(context, '关于', '/about', loc == '/about'),
                const Spacer(),
                const _ThemeToggle(),
                const SizedBox(width: 12),
                if (user != null) _UserMenu(user: user) else _authButtons(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _brand(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: () => context.go('/'),
      borderRadius: BorderRadius.circular(8),
      child: Row(children: [
        SvgPicture.asset('assets/logo.svg', width: 32, height: 32),
        const SizedBox(width: 8),
        Text('HelloTime',
            style: TextStyle(
                fontSize: AppSize.fsXl, fontWeight: AppFont.bold, color: c.textPrimary, fontFamilyFallback: AppFont.display)),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: c.brandSubtle.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(999)),
          child: ShaderMask(
            shaderCallback: (b) => AppGradients.cyberFlow.createShader(b),
            child: Text('PRO',
                style: TextStyle(fontSize: AppSize.fsSm, fontWeight: AppFont.bold, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  Widget _navLink(BuildContext context, String label, String to, bool active) {
    final c = context.colors;
    final color = active ? c.signalPrimary : c.textSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: () => context.go(to),
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(color: color, fontSize: AppSize.fsBase, fontWeight: AppFont.medium)),
            const SizedBox(height: 3),
            Container(height: 2, width: 18, color: active ? c.signalPrimary : Colors.transparent),
          ]),
        ),
      ),
    );
  }

  Widget _authButtons(BuildContext context) {
    return Row(children: [
      HtButton(label: '登录', variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => context.go('/login')),
      const SizedBox(width: 8),
      HtButton(label: '注册', variant: HtVariant.primary, size: HtSize.sm, onPressed: () => context.go('/register')),
    ]);
  }
}

class _ThemeToggle extends ConsumerWidget {
  const _ThemeToggle();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final mode = ref.watch(themeProvider);
    final dark = mode == AppThemeMode.dark;
    return IconButton(
      tooltip: dark ? '切换到浅色' : '切换到深色',
      icon: Icon(dark ? Icons.dark_mode : Icons.light_mode, color: c.textSecondary, size: 20),
      onPressed: () => ref.read(themeProvider.notifier).toggle(),
    );
  }
}

class _UserMenu extends ConsumerWidget {
  final dynamic user;
  const _UserMenu({required this.user});

  String _short(String s) => s.characters.take(4).toString();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    return PopupMenuButton<String>(
      tooltip: user.nickname,
      offset: const Offset(0, 44),
      color: c.surface2,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSize.radiusMd), side: BorderSide(color: c.borderSubtle)),
      onSelected: (v) async {
        switch (v) {
          case 'created':
            context.go('/me/created');
          case 'favorites':
            context.go('/me/favorites');
          case 'profile':
            context.go('/me/profile');
          case 'logout':
            await ref.read(authProvider.notifier).logout();
            if (context.mounted) context.go('/');
        }
      },
      itemBuilder: (context) => [
        _item('created', Icons.edit_note, '我创建的', c),
        _item('favorites', Icons.favorite_border, '我收藏的', c),
        _item('profile', Icons.settings_outlined, '账号设置', c),
        const PopupMenuDivider(),
        _item('logout', Icons.logout, '登出', c, danger: true),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), border: Border.all(color: c.borderSubtle)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(_short(user.nickname),
              style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsSm, fontWeight: AppFont.medium)),
          const SizedBox(width: 8),
          AvatarView(avatarId: user.avatarId, nickname: user.nickname, size: 24),
          const SizedBox(width: 4),
          Icon(Icons.keyboard_arrow_down, size: 16, color: c.textMuted),
        ]),
      ),
    );
  }

  PopupMenuItem<String> _item(String value, IconData icon, String label, SemanticColors c, {bool danger = false}) {
    final color = danger ? c.dangerFg : c.textSecondary;
    return PopupMenuItem<String>(
      value: value,
      height: 40,
      child: Row(children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 10),
        Text(label, style: TextStyle(color: color, fontSize: AppSize.fsSm, fontWeight: AppFont.medium)),
      ]),
    );
  }
}
