// 主外壳：宽屏（桌面）= Header + 可滚动内容区 + Footer（= React MainLayout.tsx / SwiftUI RootView）；
// 窄屏（手机）= MobileShell（顶部精简 bar + 底部 Tab Bar）。同一批页面，两套外壳 —— 一码多端。
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'app_footer.dart';
import 'app_header.dart';
import 'mobile_shell.dart';

class MainLayout extends StatelessWidget {
  final Widget child;
  const MainLayout({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.sizeOf(context).width < kWideBreakpoint) {
      return MobileShell(child: child);
    }
    return Scaffold(
      backgroundColor: context.colors.surface0,
      body: Column(children: [
        const AppHeader(),
        Expanded(child: SingleChildScrollView(child: child)),
        const AppFooter(),
      ]),
    );
  }
}

/// 居中窄/宽容器（= cy-container / --narrow）。
class Container2 extends StatelessWidget {
  final double maxWidth;
  final Widget child;
  final EdgeInsets padding;
  const Container2({
    super.key,
    required this.child,
    this.maxWidth = 1200,
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
  });
  @override
  Widget build(BuildContext context) {
    // 窄屏统一收紧边距（无视桌面传入的大 vertical），保证手机各页边距一致紧凑。
    final narrow = MediaQuery.sizeOf(context).width < kWideBreakpoint;
    final pad = narrow ? const EdgeInsets.symmetric(horizontal: 16, vertical: 20) : padding;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(padding: pad, child: child),
      ),
    );
  }
}
