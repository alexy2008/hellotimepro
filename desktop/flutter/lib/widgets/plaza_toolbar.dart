// 广场工具栏：排序（热门/最新）+ 过滤（全部/已开/未开）分段控件 + 300ms 防抖搜索。
// = React PlazaToolbar.tsx。
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../stores/plaza.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import 'mobile_shell.dart';

const _sorts = [('hot', '🔥 热门'), ('new', '✨ 最新')];
const _filters = [('all', '全部'), ('opened', '已开启'), ('unopened', '未开启')];

class PlazaToolbar extends ConsumerStatefulWidget {
  const PlazaToolbar({super.key});
  @override
  ConsumerState<PlazaToolbar> createState() => _PlazaToolbarState();
}

class _PlazaToolbarState extends ConsumerState<PlazaToolbar> {
  late final TextEditingController _ctrl;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: ref.read(plazaProvider).q);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (v != ref.read(plazaProvider).q) ref.read(plazaProvider.notifier).setQ(v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(plazaProvider);
    final narrow = MediaQuery.sizeOf(context).width < kWideBreakpoint;
    final sortSeg = _seg(context, _sorts, st.sort, (k) => ref.read(plazaProvider.notifier).setSort(k));
    final filterSeg = _seg(context, _filters, st.filter, (k) => ref.read(plazaProvider.notifier).setFilter(k));

    if (narrow) {
      // 竖排：排序+过滤（横向可滚防挤）/ 全宽搜索。= mobile/ios PlazaView 工具栏。
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [sortSeg, const SizedBox(width: 12), filterSeg]),
          ),
          const SizedBox(height: 12),
          _search(context),
        ]),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Wrap(
        spacing: 16,
        runSpacing: 12,
        crossAxisAlignment: WrapCrossAlignment.center,
        alignment: WrapAlignment.spaceBetween,
        children: [
          Wrap(spacing: 16, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.center, children: [sortSeg, filterSeg]),
          SizedBox(width: 240, child: _search(context)),
        ],
      ),
    );
  }

  Widget _search(BuildContext context) {
    final c = context.colors;
    return TextField(
      controller: _ctrl,
      onChanged: _onSearch,
      maxLength: 50,
      style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsSm),
      decoration: htInputDecoration(context, hint: '搜索标题或昵称…').copyWith(
        counterText: '',
        prefixIcon: Icon(Icons.search, size: 18, color: c.textMuted),
      ),
    );
  }

  Widget _seg(BuildContext context, List<(String, String)> opts, String active, void Function(String) onTap) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final o in opts)
          GestureDetector(
            onTap: () => onTap(o.$1),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: o.$1 == active ? c.signalPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
                boxShadow: o.$1 == active
                    ? [BoxShadow(color: c.signalPrimary.withValues(alpha: 0.45), blurRadius: 12)]
                    : null,
              ),
              child: Text(o.$2,
                  style: TextStyle(
                      color: o.$1 == active ? c.signalOn : c.textSecondary,
                      fontSize: AppSize.fsSm,
                      fontWeight: o.$1 == active ? AppFont.semibold : AppFont.regular)),
            ),
          ),
      ]),
    );
  }
}
