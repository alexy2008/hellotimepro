// 「我的」外壳：Header + 左侧栏（我创建的/我收藏的/账号设置/登出）+ 内容区 + Footer。
// = React MeLayout.tsx / SwiftUI MeView 侧栏。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../stores/auth.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import 'app_footer.dart';
import 'app_header.dart';
import 'mobile_shell.dart';

class MeLayout extends ConsumerWidget {
  final Widget child;
  const MeLayout({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final loc = GoRouterState.of(context).matchedLocation;
    // 窄屏（手机）：侧栏 → 内容顶部分段（我创建的/我收藏的/账号设置）+ 登出，外壳走 MobileShell。
    if (MediaQuery.sizeOf(context).width < kWideBreakpoint) {
      return MobileShell(
        subHeader: _mobileHeader(context, ref, c, loc),
        child: Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 16), child: child),
      );
    }
    return Scaffold(
      backgroundColor: c.surface0,
      body: Column(children: [
        const AppHeader(),
        Expanded(
          child: SingleChildScrollView(
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: AppSize.containerMax),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 200, child: _sidebar(context, ref, loc)),
                      const SizedBox(width: 32),
                      Expanded(child: child),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const AppFooter(),
      ]),
    );
  }

  /// 窄屏「我的」头：横向分段（我创建的/我收藏的/账号设置）+ 登出。固定在内容区之上。
  Widget _mobileHeader(BuildContext context, WidgetRef ref, SemanticColors c, String loc) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: c.surface0, border: Border(bottom: BorderSide(color: c.borderSubtle))),
      child: Row(children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _chip(context, '我创建的', '/me/created', loc),
              _chip(context, '我收藏的', '/me/favorites', loc),
              _chip(context, '账号设置', '/me/profile', loc),
            ]),
          ),
        ),
        IconButton(
          tooltip: '登出',
          icon: Icon(Icons.logout, size: 18, color: c.dangerFg),
          onPressed: () async {
            await ref.read(authProvider.notifier).logout();
            if (context.mounted) context.go('/');
          },
        ),
      ]),
    );
  }

  Widget _chip(BuildContext context, String label, String to, String loc) {
    final c = context.colors;
    final active = loc == to;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: active ? c.signalPrimary : c.surface2,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: () => context.go(to),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            child: Text(label,
                style: TextStyle(
                    color: active ? c.signalOn : c.textSecondary,
                    fontSize: AppSize.fsSm,
                    fontWeight: active ? AppFont.semibold : AppFont.medium)),
          ),
        ),
      ),
    );
  }

  Widget _sidebar(BuildContext context, WidgetRef ref, String loc) {
    final c = context.colors;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _navItem(context, Icons.edit_note, '我创建的', '/me/created', loc),
      _navItem(context, Icons.favorite_border, '我收藏的', '/me/favorites', loc),
      _navItem(context, Icons.settings_outlined, '账号设置', '/me/profile', loc),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Divider(color: c.borderSubtle, height: 1),
      ),
      InkWell(
        onTap: () async {
          await ref.read(authProvider.notifier).logout();
          if (context.mounted) context.go('/');
        },
        borderRadius: BorderRadius.circular(AppSize.radiusMd),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(children: [
            Icon(Icons.logout, size: 16, color: c.dangerFg),
            const SizedBox(width: 10),
            Text('登出', style: TextStyle(color: c.dangerFg, fontSize: AppSize.fsBase)),
          ]),
        ),
      ),
    ]);
  }

  Widget _navItem(BuildContext context, IconData icon, String label, String to, String loc) {
    final c = context.colors;
    final active = loc == to;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: active ? c.signalSubtle.withValues(alpha: 0.5) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppSize.radiusMd),
        child: InkWell(
          onTap: () => context.go(to),
          borderRadius: BorderRadius.circular(AppSize.radiusMd),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Icon(icon, size: 16, color: active ? c.signalPrimary : c.textSecondary),
              const SizedBox(width: 10),
              Text(label,
                  style: TextStyle(
                      color: active ? c.signalPrimary : c.textSecondary,
                      fontSize: AppSize.fsBase,
                      fontWeight: active ? AppFont.semibold : AppFont.regular)),
            ]),
          ),
        ),
      ),
    );
  }
}
