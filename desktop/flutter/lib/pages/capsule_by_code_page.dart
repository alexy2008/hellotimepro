// 胶囊详情：徽章/码/标题；已开→正文，未开→翻页时钟倒计时 + 到期自动开启轮询；
// 复制 8 位码 / 分享 / 收藏。= React CapsuleDetail.tsx / SwiftUI CapsuleDetailView。
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../utils/format.dart';
import '../widgets/favorite_button.dart';
import '../widgets/flip_clock.dart';
import '../widgets/main_layout.dart';
import '../widgets/remote_svg.dart';

class CapsuleByCodePage extends ConsumerStatefulWidget {
  final String code;
  const CapsuleByCodePage({super.key, required this.code});
  @override
  ConsumerState<CapsuleByCodePage> createState() => _CapsuleByCodePageState();
}

class _CapsuleByCodePageState extends ConsumerState<CapsuleByCodePage> {
  CapsuleDetail? _cap;
  String? _err;
  bool _loading = true;
  bool _codeCopied = false;
  bool _linkCopied = false;
  Timer? _ticker;
  Timer? _autoOpen;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _autoOpen?.cancel();
    super.dispose();
  }

  Future<void> _load({bool showLoading = true}) async {
    if (showLoading) setState(() => _loading = true);
    try {
      final cap = await ref.read(apiClientProvider).capsuleByCode(widget.code.toUpperCase());
      if (!mounted) return;
      setState(() {
        _cap = cap;
        _err = null;
        _loading = false;
      });
      _setupTimers(cap);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _err = '胶囊不存在';
        _loading = false;
        if (showLoading) _cap = null;
      });
    }
  }

  void _setupTimers(CapsuleDetail cap) {
    _ticker?.cancel();
    _autoOpen?.cancel();
    if (cap.isOpened) return;
    // 每秒刷新倒计时
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    // 到期后轮询自动开启
    final openAt = DateTime.tryParse(cap.openAt);
    if (openAt == null) return;
    final wait = openAt.difference(DateTime.now()) + const Duration(milliseconds: 250);
    _autoOpen = Timer(wait.isNegative ? Duration.zero : wait, _pollOpen);
  }

  Future<void> _pollOpen() async {
    if (!mounted) return;
    await _load(showLoading: false);
    if (mounted && _cap?.isOpened != true) {
      _autoOpen = Timer(const Duration(seconds: 1), _pollOpen);
    }
  }

  void _copyCode() {
    Clipboard.setData(ClipboardData(text: _cap!.code));
    setState(() => _codeCopied = true);
    Timer(const Duration(seconds: 2), () => mounted ? setState(() => _codeCopied = false) : null);
  }

  void _copyLink() {
    Clipboard.setData(ClipboardData(text: '用胶囊码 ${_cap!.code} 在 HelloTime Pro 打开（开启 → 输入码）'));
    setState(() => _linkCopied = true);
    Timer(const Duration(seconds: 2), () => mounted ? setState(() => _linkCopied = false) : null);
  }

  @override
  Widget build(BuildContext context) {
    return Container2(
      maxWidth: 720,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        HtButton(
            label: '返回', icon: Icons.chevron_left, variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => _back(context)),
        const SizedBox(height: 20),
        if (_loading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Center(child: CircularProgressIndicator()))
        else if (_cap != null)
          _detail(context, _cap!)
        else
          _notFound(context),
      ]),
    );
  }

  void _back(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Widget _notFound(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(children: [
          HtAlert(variant: AlertVariant.danger, text: _err ?? '胶囊不存在'),
          const SizedBox(height: 16),
          HtButton(label: '返回输入码', variant: HtVariant.ghost, onPressed: () => context.go('/open')),
        ]),
      );

  Widget _detail(BuildContext context, CapsuleDetail c) {
    final col = context.colors;
    final opened = c.isOpened;
    final accent = opened ? col.capsuleOpenedAccent : col.capsuleSealedAccent;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // 徽章行
      Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
        _badge(context, opened ? '已开启' : '未开启', accent),
        if (c.inPlaza) _badge(context, '广场公开', col.brandPrimary),
        Text(c.code, style: TextStyle(color: col.textLink, fontSize: AppSize.fsSm, fontWeight: AppFont.semibold)),
        Text('· 创建于 ${fmtDateTime(c.createdAt)}', style: TextStyle(color: col.textMuted, fontSize: AppSize.fsSm)),
      ]),
      const SizedBox(height: 16),
      Text(c.title,
          style: TextStyle(color: col.textPrimary, fontSize: AppSize.fs4xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
      const SizedBox(height: 20),
      if (opened && c.content != null) _opened(context, c) else _sealed(context, c),
      const SizedBox(height: 24),
      _footer(context, c),
      const SizedBox(height: 24),
      if (!opened)
        HtAlert(variant: AlertVariant.info, text: '未开启的胶囊仅显示标题与倒计时，内容将在开启后公开。')
      else if (c.inPlaza)
        HtAlert(variant: AlertVariant.success, text: '这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。'),
    ]);
  }

  Widget _opened(BuildContext context, CapsuleDetail c) {
    final col = context.colors;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(Icons.lock_open, size: 16, color: col.capsuleOpenedAccent),
        const SizedBox(width: 6),
        Text('开启于 ', style: TextStyle(color: col.textMuted, fontSize: AppSize.fsSm)),
        Text(fmtDateTime(c.openAt),
            style: TextStyle(color: col.capsuleOpenedAccent, fontSize: AppSize.fsSm, fontWeight: AppFont.semibold)),
      ]),
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: cardDecoration(context),
        child: SelectableText(c.content!, style: TextStyle(color: col.textSecondary, fontSize: AppSize.fsBase, height: 1.6)),
      ),
    ]);
  }

  Widget _sealed(BuildContext context, CapsuleDetail c) {
    final col = context.colors;
    final cd = countdownToIso(c.openAt);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        color: col.surface1,
        borderRadius: BorderRadius.circular(AppSize.radiusXl),
        border: Border.all(color: col.capsuleSealedBorder.withValues(alpha: 0.5)),
      ),
      child: Column(children: [
        Text('🔒', style: TextStyle(fontSize: AppSize.fs4xl)),
        const SizedBox(height: 8),
        Text('这封信还在上锁，将在以下时刻开启',
            style: TextStyle(color: col.textSecondary, fontSize: AppSize.fsSm, letterSpacing: 2)),
        const SizedBox(height: 16),
        FlipClock(days: cd.days, hours: cd.hours, minutes: cd.minutes, seconds: cd.seconds, accent: col.capsuleSealedAccent),
        const SizedBox(height: 16),
        if (cd.expired)
          Text('正在同步开启状态…', style: TextStyle(color: col.textSecondary, fontSize: AppSize.fsSm))
        else
          RichText(
            text: TextSpan(children: [
              TextSpan(text: '开启于 ', style: TextStyle(color: col.textSecondary, fontSize: AppSize.fsSm)),
              TextSpan(
                  text: fmtDateTime(c.openAt),
                  style: TextStyle(color: col.textPrimary, fontSize: AppSize.fsSm, fontWeight: AppFont.bold)),
            ]),
          ),
      ]),
    );
  }

  Widget _footer(BuildContext context, CapsuleDetail c) {
    final col = context.colors;
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.spaceBetween,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text('来自 ', style: TextStyle(color: col.textSecondary, fontSize: AppSize.fsSm)),
          AvatarView(avatarId: c.creator.avatarId, nickname: c.creator.nickname, size: 28),
          const SizedBox(width: 6),
          Text(c.creator.nickname,
              style: TextStyle(color: col.textPrimary, fontSize: AppSize.fsSm, fontWeight: AppFont.semibold)),
        ]),
        Wrap(spacing: 8, runSpacing: 8, children: [
          HtButton(
              label: _codeCopied ? '已复制!' : '复制 8 位码',
              icon: _codeCopied ? Icons.check : Icons.copy,
              variant: HtVariant.ghost,
              size: HtSize.sm,
              onPressed: _copyCode),
          HtButton(
              label: _linkCopied ? '已复制!' : '分享',
              icon: _linkCopied ? Icons.check : Icons.ios_share,
              variant: HtVariant.ghost,
              size: HtSize.sm,
              onPressed: _copyLink),
          FavoriteButton(
            capsuleId: c.id,
            favoritedByMe: c.favoritedByMe,
            favoriteCount: c.favoriteCount,
            size: FavSize.md,
            onChange: (fav, count) => setState(() => _cap = c.copyWith(favoritedByMe: fav, favoriteCount: count)),
          ),
        ]),
      ],
    );
  }

  Widget _badge(BuildContext context, String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: color, fontSize: AppSize.fsXs, fontWeight: AppFont.semibold)),
      );
}
