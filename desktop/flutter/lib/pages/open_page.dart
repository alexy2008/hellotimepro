// 凭 8 位码开启：码输入 + 开启 / 粘贴识别。成功跳详情。
// = React OpenPage.tsx / SwiftUI OpenView。
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/capsule_code_input.dart';
import '../widgets/main_layout.dart';

class OpenPage extends ConsumerStatefulWidget {
  const OpenPage({super.key});
  @override
  ConsumerState<OpenPage> createState() => _OpenPageState();
}

class _OpenPageState extends ConsumerState<OpenPage> {
  String _code = '';
  bool _busy = false;
  String? _err;

  Future<void> _open(String c) async {
    if (c.length != 8) return;
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      final cap = await ref.read(apiClientProvider).capsuleByCode(c);
      if (mounted) context.go('/c/${cap.code}');
    } catch (_) {
      if (mounted) setState(() => _err = '找不到这条胶囊');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData('text/plain');
    final text = (data?.text ?? '').toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');
    final filtered = text.length > 8 ? text.substring(0, 8) : text;
    setState(() => _code = filtered);
    if (filtered.length == 8) _open(filtered);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container2(
      maxWidth: 720,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(children: [
        Text('用 8 位密钥开启胶囊',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: c.textPrimary, fontSize: AppSize.fs3xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
        const SizedBox(height: 8),
        Text('输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。',
            textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
        const SizedBox(height: 32),
        CapsuleCodeInput(value: _code, onChanged: (v) => setState(() => _code = v), onComplete: _open),
        const SizedBox(height: 32),
        Wrap(spacing: 12, runSpacing: 12, alignment: WrapAlignment.center, children: [
          HtButton(
              label: _busy ? '查询中…' : '开启 →',
              variant: HtVariant.primary,
              size: HtSize.lg,
              loading: _busy,
              onPressed: (_busy || _code.length != 8) ? null : () => _open(_code)),
          HtButton(label: '粘贴识别', variant: HtVariant.ghost, size: HtSize.lg, onPressed: _paste),
        ]),
        const SizedBox(height: 40),
        Wrap(spacing: 16, runSpacing: 8, alignment: WrapAlignment.center, children: [
          _hint(context, Icons.link, '可用 /c/<code> 直链访问'),
          _hint(context, Icons.lock_outline, '未到时间的胶囊也会显示倒计时'),
        ]),
        if (_err != null) ...[
          const SizedBox(height: 24),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 480), child: HtAlert(variant: AlertVariant.danger, text: _err!)),
        ],
      ]),
    );
  }

  Widget _hint(BuildContext context, IconData icon, String text) {
    final c = context.colors;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: c.textMuted),
      const SizedBox(width: 4),
      Text(text, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
    ]);
  }
}
