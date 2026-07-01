// 创建胶囊：标题(+AI生成) · AI 推荐灵感 · 正文(计数) · 开启时间(选择器/预设) · 可见性。
// = React CreatePage.tsx / SwiftUI CreateView。
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
import '../widgets/date_time_picker.dart';
import '../widgets/main_layout.dart';
import '../widgets/recommendation_strip.dart';

class CreatePage extends ConsumerStatefulWidget {
  const CreatePage({super.key});
  @override
  ConsumerState<CreatePage> createState() => _CreatePageState();
}

class _CreatePageState extends ConsumerState<CreatePage> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  DateTime _openAt = DateTime.now().add(const Duration(hours: 1));
  bool _inPlaza = true;
  bool _busy = false;
  String? _err;

  bool _aiBusy = false;
  String? _aiInfo;
  bool _aiGenerated = false;

  List<CapsuleRecommendation> _recos = [];
  bool _recoBusy = false;
  int _recoSeq = 0;

  @override
  void initState() {
    super.initState();
    _title.addListener(() => setState(() {}));
    _content.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRecos());
  }

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _title.text.trim().isNotEmpty && _title.text.length <= 60 && _content.text.isNotEmpty && _content.text.length <= 5000;

  Future<void> _loadRecos() async {
    final seq = ++_recoSeq;
    setState(() => _recoBusy = true);
    try {
      final list = await ref.read(apiClientProvider).capsuleRecommendations(count: 4);
      if (seq != _recoSeq) return;
      if (list.items.isNotEmpty) setState(() => _recos = list.items);
    } catch (_) {
      /* 锦上添花，失败静默 */
    } finally {
      if (seq == _recoSeq && mounted) setState(() => _recoBusy = false);
    }
  }

  Future<void> _runAi(String rawTitle) async {
    final t = rawTitle.trim();
    final autoTitle = t.isEmpty;
    setState(() {
      _err = null;
      _aiInfo = null;
      _aiBusy = true;
    });
    try {
      final s = await ref.read(apiClientProvider).suggestCapsule(title: t.isEmpty ? null : t);
      _content.text = s.content;
      final d = parseIso(s.openAt);
      if (d != null) _openAt = d;
      _aiGenerated = true;
      if (s.title != null && autoTitle && _title.text.trim().isEmpty) _title.text = s.title!;
      final source = s.generatedBy == 'local-template' ? '本地模板（LLM 未启用）' : s.generatedBy;
      final note = (s.title != null && autoTitle) ? '标题与正文均由 AI 生成' : '已为你生成正文';
      setState(() => _aiInfo = '$note，建议 ${s.openInDays} 天后开启 · 来源：$source');
    } catch (_) {
      setState(() => _err = 'AI 生成失败，请稍后重试');
    } finally {
      if (mounted) setState(() => _aiBusy = false);
    }
  }

  void _pickReco(CapsuleRecommendation r) {
    _title.text = r.title;
    _content.clear();
    _aiGenerated = false;
    _runAi(r.title);
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final created = await ref.read(apiClientProvider).createCapsule(CreateCapsuleRequest(
        title: _title.text.trim(),
        content: _content.text,
        openAt: isoFrom(_openAt),
        inPlaza: _inPlaza,
      ));
      if (mounted) context.go('/c/${created.code}');
    } catch (e) {
      setState(() => _err = e is ApiException ? e.message : '创建失败');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final showRecos = _title.text.trim().isEmpty && _recos.isNotEmpty;

    return Container2(
      maxWidth: 720,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('写给未来的信',
            style: TextStyle(
                color: c.textPrimary, fontSize: AppSize.fs4xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
        const SizedBox(height: 8),
        Text('这段文字会被上锁，直到你设定的时刻才能由任何人（包括你自己）开启。',
            style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
        const SizedBox(height: 24),

        // 标题
        const FieldLabel('标题', hint: '· 最多 60 字'),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: TextField(
              controller: _title,
              maxLength: 60,
              style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsBase),
              decoration: htInputDecoration(context, hint: '给这枚胶囊起个名字').copyWith(counterText: ''),
            ),
          ),
          const SizedBox(width: 8),
          HtButton(
              label: _aiBusy ? '生成中…' : _aiGenerated ? '✨ 重新生成' : '✨ AI 生成',
              variant: HtVariant.ghost,
              loading: _aiBusy,
              onPressed: _aiBusy ? null : () => _runAi(_title.text)),
        ]),
        if (_aiInfo != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(_aiInfo!, style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsSm)),
          ),
        const SizedBox(height: 16),

        if (showRecos) ...[
          RecommendationStrip(
              recos: _recos, busy: _recoBusy, disabled: _aiBusy, onPick: _pickReco, onRefresh: _loadRecos),
          const SizedBox(height: 16),
        ],

        // 正文
        const FieldLabel('内容', hint: '· 最多 5000 字'),
        TextField(
          controller: _content,
          maxLines: 9,
          maxLength: 5000,
          style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsBase, height: 1.5),
          inputFormatters: [LengthLimitingTextInputFormatter(5000)],
          decoration: htInputDecoration(context, hint: '在这里写下你想传递到未来的话…').copyWith(counterText: ''),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: Text('${_content.text.length} / 5000', style: TextStyle(color: c.textDisabled, fontSize: AppSize.fsXs)),
        ),
        const SizedBox(height: 16),

        // 开启时间
        Row(children: [
          const FieldLabel('开启时间', hint: '· 最早 60 秒后'),
        ]),
        HtDateTimePicker(value: _openAt, onChanged: (d) => setState(() => _openAt = d)),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text('快速预设', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm, fontWeight: AppFont.medium)),
            _preset('1 分钟后（测试）', () => DateTime.now().add(const Duration(seconds: 130))),
            _preset('1 小时后', () => DateTime.now().add(const Duration(hours: 1))),
            _preset('明天 9:00', _tomorrow9),
            _preset('1 年后', () => DateTime(DateTime.now().year + 1, DateTime.now().month, DateTime.now().day)),
            _preset('2030.01.01', () => DateTime(2030, 1, 1)),
          ]),
        ),
        const SizedBox(height: 24),

        HtAlert(variant: AlertVariant.info, text: '上锁后不可编辑、不可提前开启；可以在「我创建的」列表里随时撤回（删除）。'),
        if (_err != null) ...[const SizedBox(height: 12), HtAlert(variant: AlertVariant.danger, text: _err!)],
        const SizedBox(height: 24),

        // 底部操作栏：可见性开关（左）+ 取消/封存（右）
        Row(children: [
          Switch(value: _inPlaza, activeThumbColor: c.signalPrimary, onChanged: (v) => setState(() => _inPlaza = v)),
          Text('发布到胶囊广场', style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
          const Spacer(),
          HtButton(label: '取消', variant: HtVariant.ghost, onPressed: () => context.go('/')),
          const SizedBox(width: 8),
          HtButton(
              label: _busy ? '封存中…' : '🔒 上锁封存',
              variant: HtVariant.primary,
              size: HtSize.lg,
              loading: _busy,
              onPressed: (_busy || !_canSubmit) ? null : _submit),
        ]),
      ]),
    );
  }

  Widget _preset(String label, DateTime Function() make) =>
      HtButton(label: label, variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => setState(() => _openAt = make()));

  DateTime _tomorrow9() {
    final t = DateTime.now().add(const Duration(days: 1));
    return DateTime(t.year, t.month, t.day, 9, 0);
  }
}
