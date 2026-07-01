// 关于页：产品简介 + 桌面端技术栈（Flutter/Dart）+ 后端技术栈（from health）+ 元信息。
// = React AboutPage.tsx / SwiftUI AboutView。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../models/models.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/main_layout.dart';
import '../widgets/remote_svg.dart';

const _desktopStack = [
  ('shell', 'Flutter', '3', '/static/icons/flutter.svg'),
  ('language', 'Dart', '3', '/static/icons/dart.svg'),
];

const _desktopSummary =
    '本页运行在纯原生 Flutter 桌面端：零 webview、零内嵌 SPA，整套 UI 用 Dart 声明式重建，'
    '由 Skia/Impeller 引擎自绘渲染。状态管理用 Riverpod，路由用 go_router，'
    'HTTP 直连反代 :9080，复用同一套 /api/v1 契约——桌面壳本身不持有 API。'
    '与之对照：electron/tauri 是 Web 壳内嵌前端，swiftui 是 macOS 系统原生声明式 UI。'
    'Flutter 的看点在「一份代码多端投影」：同一套 Dart 代码可同时跑桌面与移动，仅布局按断点分叉。';

class AboutPage extends ConsumerStatefulWidget {
  const AboutPage({super.key});
  @override
  ConsumerState<AboutPage> createState() => _AboutPageState();
}

class _AboutPageState extends ConsumerState<AboutPage> {
  HealthData? _health;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final d = await ref.read(apiClientProvider).health();
        if (mounted) setState(() => _health = d);
      } catch (e) {
        if (mounted) setState(() => _error = '$e');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final api = ref.read(apiClientProvider);
    final backendItems = _health == null
        ? <StackItem>[]
        : ([..._health!.stack.items]..sort((a, b) {
            const order = ['framework', 'language', 'database'];
            return order.indexOf(a.role) - order.indexOf(b.role);
          }));
    final fw = _health?.stack.items.where((it) => it.role == 'framework');
    final backendFramework = (fw == null || fw.isEmpty) ? '—' : fw.first.name;

    return Container2(
      maxWidth: 720,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // 标题
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text('关于 ',
              style: TextStyle(
                  color: c.textPrimary, fontSize: AppSize.fs5xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
          ShaderMask(
            shaderCallback: (b) => c.gradientBrandHero.createShader(b),
            child: Text('HelloTime Pro',
                style: TextStyle(
                    color: Colors.white, fontSize: AppSize.fs5xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
          ),
        ]),
        const SizedBox(height: 12),
        Text(
          '一款时光胶囊应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。'
          '支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，'
          '同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。',
          style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsLg, height: 1.7),
        ),
        const SizedBox(height: 40),

        _section(context, '桌面端技术栈',
            _stackCard(context, api, [for (final s in _desktopStack) (s.$2, s.$3, s.$4)], _desktopSummary)),
        const SizedBox(height: 40),

        if (_error != null) HtAlert(variant: AlertVariant.danger, text: '无法读取后端信息：$_error'),
        if (_health != null)
          _section(
              context,
              '后端技术栈',
              _stackCard(context, api,
                  [for (final it in backendItems) (it.name, it.version, it.iconUrl)], _health!.stack.summary)),

        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: c.borderSubtle))),
          child: Wrap(spacing: 24, runSpacing: 8, children: [
            _meta(context, '桌面端', 'Flutter + Dart'),
            _meta(context, '后端', backendFramework),
            Text('License: MIT', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
          ]),
        ),
      ]),
    );
  }

  Widget _section(BuildContext context, String title, Widget body) {
    final c = context.colors;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title,
          style: TextStyle(color: c.textPrimary, fontSize: AppSize.fs2xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
      const SizedBox(height: 16),
      body,
    ]);
  }

  Widget _stackCard(BuildContext context, ApiClient api, List<(String, String, String?)> items, String summary) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: cardDecoration(context),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 24, runSpacing: 16, children: [
          for (final it in items)
            Column(mainAxisSize: MainAxisSize.min, children: [
              if (it.$3 != null) SvgIcon(url: api.resolveAsset(it.$3!), size: 40) else const SizedBox(width: 40, height: 40),
              const SizedBox(height: 4),
              Text('${it.$1}${it.$2.isNotEmpty ? ' ${it.$2}' : ''}',
                  style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs, fontFamilyFallback: AppFont.mono)),
            ]),
        ]),
        const SizedBox(height: 16),
        Text(summary, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase, height: 1.7)),
      ]),
    );
  }

  Widget _meta(BuildContext context, String label, String value) {
    final c = context.colors;
    return RichText(
      text: TextSpan(children: [
        TextSpan(text: '$label：', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
        TextSpan(
            text: value,
            style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm, fontFamilyFallback: AppFont.mono)),
      ]),
    );
  }
}
