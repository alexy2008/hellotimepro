// 通用分页器：上一页 / 第 X / Y 页 · 共 N 条 / 下一页（= React Pagination.tsx）。
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';

class Pagination extends StatelessWidget {
  final int page;
  final int totalPages;
  final ValueChanged<int> onChange;
  final String? extra;
  final bool alwaysShow;

  const Pagination({
    super.key,
    required this.page,
    required this.totalPages,
    required this.onChange,
    this.extra,
    this.alwaysShow = false,
  });

  @override
  Widget build(BuildContext context) {
    if (!alwaysShow && totalPages <= 1) return const SizedBox.shrink();
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        HtButton(
            label: '上一页',
            variant: HtVariant.ghost,
            size: HtSize.sm,
            onPressed: page <= 1 ? null : () => onChange(page - 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text('第 $page / $totalPages 页${extra != null ? ' · $extra' : ''}',
              style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
        ),
        HtButton(
            label: '下一页',
            variant: HtVariant.ghost,
            size: HtSize.sm,
            onPressed: page >= totalPages ? null : () => onChange(page + 1)),
      ]),
    );
  }
}
