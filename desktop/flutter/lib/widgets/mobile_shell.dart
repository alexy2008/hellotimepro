// 移动窄屏外壳：精简顶部 bar（品牌 + 主题切换 + 关于）+ 底部 Tab Bar（广场/开启/创建/我的）。
// 「一码多端」的移动投影：桌面宽屏走 MainLayout/MeLayout 现状（顶部 nav + Footer），
// 窄屏（手机）复用同一批页面，只换外壳 —— 底部 NavigationBar 替代顶部导航（= mobile.html / mobile/ios 的移动 IA）。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../stores/theme.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';

/// 宽窄断点：>= 此宽度走桌面外壳，否则移动外壳。
/// 740 使手机竖屏（≤430）走移动、常规桌面窗口与 iPad 竖屏走桌面。
const double kWideBreakpoint = 740;

class MobileShell extends ConsumerWidget {
  final Widget child;

  /// 内容区之上的固定子头（如「我的」的分段切换）；随内容一起在底部 Tab Bar 之上。
  final Widget? subHeader;
  const MobileShell({super.key, required this.child, this.subHeader});

  // (路由, 图标, 标签)。「创建 / 我的」为受保护路由，未登录点击由 go_router redirect 自动跳登录（同桌面）。
  static const _tabs = <(String, IconData, String)>[
    ('/', Icons.grid_view_rounded, '广场'),
    ('/open', Icons.lock_open_rounded, '开启'),
    ('/create', Icons.add_circle_outline_rounded, '创建'),
    ('/me/created', Icons.person_outline_rounded, '我的'),
  ];

  bool _showNav(String loc) =>
      loc == '/' || loc == '/open' || loc == '/create' || loc.startsWith('/me');

  int _currentIndex(String loc) {
    if (loc == '/open') return 1;
    if (loc == '/create') return 2;
    if (loc.startsWith('/me')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final loc = GoRouterState.of(context).matchedLocation;
    return Scaffold(
      backgroundColor: c.surface0,
      appBar: _appBar(context, ref, c),
      body: SafeArea(
        top: false,
        child: Column(children: [
          ?subHeader,
          Expanded(child: SingleChildScrollView(child: child)),
        ]),
      ),
      bottomNavigationBar: _showNav(loc) ? _bottomNav(context, c, loc) : null,
    );
  }

  PreferredSizeWidget _appBar(BuildContext context, WidgetRef ref, SemanticColors c) {
    final dark = ref.watch(themeProvider) == AppThemeMode.dark;
    return AppBar(
      backgroundColor: c.surface0,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      titleSpacing: 16,
      title: InkWell(
        onTap: () => context.go('/'),
        borderRadius: BorderRadius.circular(8),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SvgPicture.asset('assets/logo.svg', width: 26, height: 26),
          const SizedBox(width: 8),
          Text('HelloTime',
              style: TextStyle(
                  fontSize: AppSize.fsLg,
                  fontWeight: AppFont.bold,
                  color: c.textPrimary,
                  fontFamilyFallback: AppFont.display)),
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration:
                BoxDecoration(color: c.brandSubtle.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(999)),
            child: ShaderMask(
              shaderCallback: (b) => AppGradients.cyberFlow.createShader(b),
              child: Text('PRO',
                  style: TextStyle(fontSize: AppSize.fsXs, fontWeight: AppFont.bold, color: Colors.white)),
            ),
          ),
        ]),
      ),
      actions: [
        IconButton(
          tooltip: dark ? '切换到浅色' : '切换到深色',
          icon: Icon(dark ? Icons.dark_mode : Icons.light_mode, color: c.textSecondary, size: 20),
          onPressed: () => ref.read(themeProvider.notifier).toggle(),
        ),
        IconButton(
          tooltip: '关于',
          icon: Icon(Icons.info_outline, color: c.textSecondary, size: 20),
          onPressed: () => context.go('/about'),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  Widget _bottomNav(BuildContext context, SemanticColors c, String loc) {
    return NavigationBar(
      backgroundColor: c.surface1,
      indicatorColor: c.signalSubtle,
      surfaceTintColor: Colors.transparent,
      height: 64,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      selectedIndex: _currentIndex(loc),
      onDestinationSelected: (i) => context.go(_tabs[i].$1),
      destinations: [
        for (final t in _tabs)
          NavigationDestination(
            icon: Icon(t.$2, color: c.textMuted),
            selectedIcon: Icon(t.$2, color: c.signalPrimary),
            label: t.$3,
          ),
      ],
    );
  }
}
