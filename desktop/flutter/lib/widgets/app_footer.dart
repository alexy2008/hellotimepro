// 底部页脚：版权 + 后端在线指示点 + 技术栈（桌面端 Flutter/Dart + 后端 from health）。
// = React AppFooter.tsx / SwiftUI AppFooter.swift。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import 'remote_svg.dart';

/// 桌面端原生技术栈（对照 React 页脚前端三件套 / SwiftUI 的 SwiftUI+Swift）。
const _desktopStack = [
  ('desktop', 'Flutter', '/static/icons/flutter.svg'),
  ('language', 'Dart', '/static/icons/dart.svg'),
];

class AppFooter extends ConsumerStatefulWidget {
  const AppFooter({super.key});
  @override
  ConsumerState<AppFooter> createState() => _AppFooterState();
}

class _AppFooterState extends ConsumerState<AppFooter> {
  HealthData? _health;
  bool? _connected;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final h = await ref.read(apiClientProvider).health();
      if (mounted) {
        setState(() {
          _health = h;
          _connected = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final api = ref.read(apiClientProvider);
    final dotColor = _connected == true ? c.successSolid : _connected == false ? c.dangerSolid : c.textDisabled;
    final backendItems = _health?.stack.items ?? [];

    return Container(
      height: AppSize.footerHeight,
      decoration: BoxDecoration(color: c.surface0, border: Border(top: BorderSide(color: c.borderSubtle))),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: AppSize.containerMax),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(children: [
              Text('© 2026 HelloTime Pro', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
              const SizedBox(width: 6),
              Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
              const Spacer(),
              Flexible(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    for (final it in _desktopStack) _stackItem(context, it.$2, api.resolveAsset(it.$3)),
                    for (final it in backendItems)
                      _stackItem(context, it.name, it.iconUrl != null ? api.resolveAsset(it.iconUrl!) : null),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _stackItem(BuildContext context, String name, String? iconUrl) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(left: 16),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (iconUrl != null) ...[SvgIcon(url: iconUrl, size: 16), const SizedBox(width: 4)],
        Text(name, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)),
      ]),
    );
  }
}
