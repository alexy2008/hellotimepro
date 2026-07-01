// 广场首页：hero（三色渐变标题 + 紫光背景 + 双 hero CTA）+ 工具栏 + 网格 + 分页。
// = React PlazaPage.tsx / SwiftUI PlazaView。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../stores/auth.dart';
import '../stores/plaza.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/capsule_grid.dart';
import '../widgets/main_layout.dart';
import '../widgets/mobile_shell.dart';
import '../widgets/pagination.dart';
import '../widgets/plaza_toolbar.dart';

class PlazaPage extends ConsumerStatefulWidget {
  const PlazaPage({super.key});
  @override
  ConsumerState<PlazaPage> createState() => _PlazaPageState();
}

class _PlazaPageState extends ConsumerState<PlazaPage> {
  @override
  void initState() {
    super.initState();
    // 等鉴权 hydrate 后再拉，保证 favoritedByMe 投影正确
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(authProvider).hydrated) ref.read(plazaProvider.notifier).fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(plazaProvider);
    final user = ref.watch(authProvider).user;

    return Column(children: [
      _hero(context, user != null),
      Container2(
        child: Column(children: [
          const PlazaToolbar(),
          CapsuleGrid(
            items: st.items,
            loading: st.loading,
            emptyHint: _emptyHint(context, user != null),
          ),
          Pagination(
            page: st.page,
            totalPages: st.pagination?.totalPages ?? 0,
            onChange: ref.read(plazaProvider.notifier).setPage,
            extra: st.pagination != null ? '共 ${st.pagination!.total} 条' : null,
          ),
        ]),
      ),
    ]);
  }

  Widget _hero(BuildContext context, bool authed) {
    final c = context.colors;
    final narrow = MediaQuery.sizeOf(context).width < kWideBreakpoint;
    final titleFs = narrow ? AppSize.fs3xl : AppSize.fs5xl;
    return Container(
      decoration: BoxDecoration(gradient: c.gradientBrandSubtle),
      child: Stack(alignment: Alignment.center, children: [
        // 居中模糊紫光（用 plaza glow 紫）；窄屏收小防溢出
        Positioned.fill(
          child: Center(
            child: Container(
              width: narrow ? 300 : 520,
              height: narrow ? 150 : 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: c.plazaGlow, blurRadius: narrow ? 80 : 120, spreadRadius: narrow ? 16 : 30)],
              ),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(vertical: narrow ? 32 : 56, horizontal: 24),
          child: Column(children: [
            // 标题：纯色 + 渐变高亮（同一行）
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('封存此刻 ',
                    style: TextStyle(
                        fontSize: titleFs,
                        fontWeight: AppFont.bold,
                        color: c.textPrimary,
                        fontFamilyFallback: AppFont.display)),
                ShaderMask(
                  shaderCallback: (b) => c.gradientBrandHero.createShader(b),
                  child: Text('开启未来',
                      style: TextStyle(
                          fontSize: titleFs,
                          fontWeight: AppFont.bold,
                          color: Colors.white,
                          fontFamilyFallback: AppFont.display)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Text(
                '写下此刻最真实的想法，设定一个解封时刻——明年生日、十年后的清晨，或任何值得等待的瞬间。时间到了，它才会被打开。',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase, height: 1.6),
              ),
            ),
            const SizedBox(height: 24),
            Wrap(spacing: 12, runSpacing: 12, alignment: WrapAlignment.center, children: [
              HtButton(
                label: '创建我的胶囊',
                icon: Icons.auto_awesome,
                variant: HtVariant.heroPrimary,
                onPressed: () => context.go(authed ? '/create' : '/register'),
              ),
              HtButton(
                label: '用胶囊码开启',
                icon: Icons.lock_open,
                variant: HtVariant.heroSuccess,
                onPressed: () => context.go('/open'),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }

  Widget _emptyHint(BuildContext context, bool authed) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64),
      child: Center(
        child: Column(children: [
          const Text('🌌', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text('广场暂无胶囊 —— 来当第一个写信给未来的人？',
              style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
          const SizedBox(height: 12),
          HtButton(
              label: authed ? '创建胶囊' : '注册并创建',
              variant: HtVariant.primary,
              size: HtSize.sm,
              onPressed: () => context.go(authed ? '/create' : '/register')),
        ]),
      ),
    );
  }
}
