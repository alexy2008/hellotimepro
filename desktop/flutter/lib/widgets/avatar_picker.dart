// 头像选择器：10 个内置 SVG 头像网格，选中描边高亮（= React AvatarPicker.tsx）。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import 'remote_svg.dart';

class AvatarPicker extends ConsumerWidget {
  final List<Avatar> avatars;
  final String? value;
  final ValueChanged<String> onChange;
  const AvatarPicker({super.key, required this.avatars, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final api = ref.read(apiClientProvider);
    return Wrap(spacing: 10, runSpacing: 10, children: [
      for (final a in avatars)
        Tooltip(
          message: a.name,
          child: GestureDetector(
            onTap: () => onChange(a.id),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                    color: value == a.id ? c.signalPrimary : c.borderSubtle, width: value == a.id ? 2 : 1),
                boxShadow: value == a.id
                    ? [BoxShadow(color: c.signalPrimary.withValues(alpha: 0.45), blurRadius: 10)]
                    : null,
              ),
              child: ClipOval(
                child: RemoteSvg(url: api.avatarUrl(a.id), width: 44, height: 44),
              ),
            ),
          ),
        ),
    ]);
  }
}
