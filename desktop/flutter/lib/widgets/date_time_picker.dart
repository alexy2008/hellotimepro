// 日期时间选择器：触发按钮（单行：⏱ + 显示值 + 距开启）→ 弹层。
// 弹层含：手动 年/月/日/时/分 键盘输入(+↑↓ 步进) · 月历(周一起) · 时/分 + 时钟表盘 · 预设。
// draft 模式，仅「确认」提交。= React DateTimePicker.tsx / SwiftUI DateTimePicker.swift。
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../utils/format.dart';

const _weekdays = ['一', '二', '三', '四', '五', '六', '日'];

String _distance(DateTime d, [DateTime? now]) {
  final diffMin = (d.difference(now ?? DateTime.now()).inMilliseconds / 60000).ceil();
  if (diffMin <= 0) return '已到开启时刻';
  if (diffMin < 60) return '距开启 $diffMin 分钟';
  final hours = diffMin ~/ 60;
  final minutes = diffMin % 60;
  if (hours < 24) return '距开启 $hours 小时${minutes != 0 ? ' $minutes 分钟' : ''}';
  final days = hours ~/ 24;
  final restHours = hours % 24;
  if (days < 365) return '距开启 $days 天${restHours != 0 ? ' $restHours 小时' : ''}';
  final years = days ~/ 365;
  final restDays = days % 365;
  return '距开启 $years 年${restDays != 0 ? ' $restDays 天' : ''}';
}

int _daysInMonth(int year, int month) => DateTime(year, month + 1, 0).day;

class HtDateTimePicker extends StatelessWidget {
  final DateTime value;
  final ValueChanged<DateTime> onChanged;
  const HtDateTimePicker({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      borderRadius: BorderRadius.circular(AppSize.radiusMd),
      onTap: () async {
        final picked = await showDialog<DateTime>(
          context: context,
          builder: (_) => _PickerDialog(initial: value),
        );
        if (picked != null) onChanged(picked);
      },
      child: Container(
        constraints: const BoxConstraints(minHeight: 46),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: c.surface3,
          borderRadius: BorderRadius.circular(AppSize.radiusMd),
          border: Border.all(color: c.borderDefault),
        ),
        child: Row(children: [
          Icon(Icons.schedule, size: 20, color: c.signalPrimary),
          const SizedBox(width: 12),
          Expanded(
            child: Row(children: [
              Flexible(
                child: Text(formatDisplay(value),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsBase, fontWeight: AppFont.medium)),
              ),
              const SizedBox(width: 8),
              Text(_distance(value), maxLines: 1, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)),
            ]),
          ),
          Icon(Icons.keyboard_arrow_down, size: 18, color: c.signalPrimary),
        ]),
      ),
    );
  }
}

class _PickerDialog extends StatefulWidget {
  final DateTime initial;
  const _PickerDialog({required this.initial});
  @override
  State<_PickerDialog> createState() => _PickerDialogState();
}

class _PickerDialogState extends State<_PickerDialog> {
  late DateTime _draft;
  late DateTime _viewMonth;
  final _year = TextEditingController();
  final _month = TextEditingController();
  final _day = TextEditingController();
  final _hour = TextEditingController();
  final _minute = TextEditingController();

  @override
  void initState() {
    super.initState();
    _draft = DateTime(widget.initial.year, widget.initial.month, widget.initial.day, widget.initial.hour, widget.initial.minute);
    _viewMonth = DateTime(_draft.year, _draft.month, 1);
    _syncManual();
  }

  @override
  void dispose() {
    for (final c in [_year, _month, _day, _hour, _minute]) {
      c.dispose();
    }
    super.dispose();
  }

  void _syncManual() {
    _year.text = '${_draft.year}';
    _month.text = pad2(_draft.month);
    _day.text = pad2(_draft.day);
    _hour.text = pad2(_draft.hour);
    _minute.text = pad2(_draft.minute);
  }

  void _setDraft(DateTime d, {bool syncView = true}) {
    setState(() {
      _draft = d;
      if (syncView) _viewMonth = DateTime(d.year, d.month, 1);
      _syncManual();
    });
  }

  void _adjust(String field, int delta) {
    DateTime n;
    switch (field) {
      case 'year':
        final y = (_draft.year + delta).clamp(1, 9999);
        n = DateTime(y, _draft.month, math.min(_draft.day, _daysInMonth(y, _draft.month)), _draft.hour, _draft.minute);
      case 'month':
        final base = DateTime(_draft.year, _draft.month + delta, 1);
        n = DateTime(base.year, base.month, math.min(_draft.day, _daysInMonth(base.year, base.month)), _draft.hour, _draft.minute);
      case 'day':
        n = _draft.add(Duration(days: delta));
      case 'hour':
        n = _draft.add(Duration(hours: delta));
      default:
        n = _draft.add(Duration(minutes: delta));
    }
    _setDraft(n);
  }

  void _onManualChanged() {
    final y = int.tryParse(_year.text);
    final m = int.tryParse(_month.text);
    final d = int.tryParse(_day.text);
    final h = int.tryParse(_hour.text);
    final min = int.tryParse(_minute.text);
    if (_year.text.length != 4 || m == null || d == null || h == null || min == null || y == null) return;
    if (y < 1 || m < 1 || m > 12 || h < 0 || h > 23 || min < 0 || min > 59) return;
    if (d < 1 || d > _daysInMonth(y, m)) return;
    setState(() {
      _draft = DateTime(y, m, d, h, min);
      _viewMonth = DateTime(y, m, 1);
    });
  }

  void _normalize() {
    final y = (int.tryParse(_year.text) ?? _draft.year).clamp(1, 9999);
    final m = (int.tryParse(_month.text) ?? _draft.month).clamp(1, 12);
    final d = (int.tryParse(_day.text) ?? _draft.day).clamp(1, _daysInMonth(y, m));
    final h = (int.tryParse(_hour.text) ?? _draft.hour).clamp(0, 23);
    final min = (int.tryParse(_minute.text) ?? _draft.minute).clamp(0, 59);
    _setDraft(DateTime(y, m, d, h, min));
  }

  void _preset(String spec) {
    final now = DateTime.now();
    final base = DateTime(now.year, now.month, now.day, now.hour, now.minute);
    DateTime n;
    switch (spec) {
      case '1m':
        n = base.add(const Duration(minutes: 2));
      case '1h':
        n = base.add(const Duration(hours: 1));
      case 'tomorrow9':
        final t = base.add(const Duration(days: 1));
        n = DateTime(t.year, t.month, t.day, 9, 0);
      case '1y':
        n = DateTime(base.year + 1, base.month, base.day, base.hour, base.minute);
      default:
        n = DateTime(2030, 1, 1, 0, 0);
    }
    _setDraft(n);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Dialog(
      backgroundColor: c.surface1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSize.radiusLg), side: BorderSide(color: c.borderSubtle)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 640),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            _topbar(context),
            const SizedBox(height: 16),
            _calendar(context),
            const SizedBox(height: 16),
            _timePane(context),
            const SizedBox(height: 16),
            _presets(context),
          ]),
        ),
      ),
    );
  }

  Widget _topbar(BuildContext context) {
    final c = context.colors;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('选择开启时刻', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)),
          Text(_distance(_draft), style: TextStyle(color: c.signalPrimary, fontSize: AppSize.fsBase, fontWeight: AppFont.semibold)),
        ]),
        const Spacer(),
        HtButton(label: '取消', variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => Navigator.pop(context)),
        const SizedBox(width: 8),
        HtButton(label: '确认', variant: HtVariant.primary, size: HtSize.sm, onPressed: () => Navigator.pop(context, _draft)),
      ]),
      const SizedBox(height: 12),
      Row(children: [
        _manualField(context, _year, 'year', 4, 56),
        _unit(context, '年'),
        _manualField(context, _month, 'month', 2, 38),
        _unit(context, '月'),
        _manualField(context, _day, 'day', 2, 38),
        _unit(context, '日'),
        _manualField(context, _hour, 'hour', 2, 38),
        _unit(context, ':'),
        _manualField(context, _minute, 'minute', 2, 38),
      ]),
    ]);
  }

  Widget _unit(BuildContext context, String s) =>
      Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: Text(s, style: TextStyle(color: context.colors.textSecondary)));

  Widget _manualField(BuildContext context, TextEditingController ctrl, String field, int maxLen, double width) {
    final c = context.colors;
    return SizedBox(
      width: width,
      child: Focus(
        onKeyEvent: (_, e) {
          if (e is KeyDownEvent && e.logicalKey == LogicalKeyboardKey.arrowUp) {
            _adjust(field, 1);
            return KeyEventResult.handled;
          }
          if (e is KeyDownEvent && e.logicalKey == LogicalKeyboardKey.arrowDown) {
            _adjust(field, -1);
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        onFocusChange: (has) {
          if (!has) _normalize();
        },
        child: TextField(
          controller: ctrl,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(maxLen)],
          style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsBase),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            filled: true,
            fillColor: c.surface3,
            enabledBorder:
                OutlineInputBorder(borderRadius: BorderRadius.circular(AppSize.radiusSm), borderSide: BorderSide(color: c.borderDefault)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSize.radiusSm), borderSide: BorderSide(color: c.signalPrimary)),
          ),
          onChanged: (_) => _onManualChanged(),
          onSubmitted: (_) => _normalize(),
        ),
      ),
    );
  }

  Widget _calendar(BuildContext context) {
    final c = context.colors;
    final year = _viewMonth.year;
    final month = _viewMonth.month;
    final leading = (DateTime(year, month, 1).weekday - 1) % 7; // 周一起
    final total = _daysInMonth(year, month);
    final today = DateTime.now();

    return Column(children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        IconButton(
            onPressed: () => setState(() => _viewMonth = DateTime(year, month - 1, 1)),
            icon: Icon(Icons.chevron_left, color: c.textSecondary)),
        Text('$year年$month月', style: TextStyle(color: c.textPrimary, fontWeight: AppFont.semibold)),
        IconButton(
            onPressed: () => setState(() => _viewMonth = DateTime(year, month + 1, 1)),
            icon: Icon(Icons.chevron_right, color: c.textSecondary)),
      ]),
      Row(
        children: _weekdays
            .map((w) => Expanded(
                child: Center(child: Text(w, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)))))
            .toList(),
      ),
      const SizedBox(height: 4),
      GridView.count(
        crossAxisCount: 7,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 1.1,
        children: [
          for (var i = 0; i < leading; i++) const SizedBox(),
          for (var day = 1; day <= total; day++) _dayCell(context, year, month, day, today),
        ],
      ),
    ]);
  }

  Widget _dayCell(BuildContext context, int year, int month, int day, DateTime today) {
    final c = context.colors;
    final selected = _draft.year == year && _draft.month == month && _draft.day == day;
    final isToday = today.year == year && today.month == month && today.day == day;
    return Padding(
      padding: const EdgeInsets.all(2),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => _setDraft(DateTime(year, month, day, _draft.hour, _draft.minute), syncView: false),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: selected ? c.signalPrimary : Colors.transparent,
            border: !selected && isToday ? Border.all(color: c.signalPrimary.withValues(alpha: 0.6)) : null,
          ),
          child: Text('$day',
              style: TextStyle(
                  color: selected ? c.signalOn : c.textSecondary,
                  fontSize: AppSize.fsSm,
                  fontWeight: selected ? AppFont.semibold : AppFont.regular)),
        ),
      ),
    );
  }

  Widget _timePane(BuildContext context) {
    final c = context.colors;
    final minutes = {for (var i = 0; i < 12; i++) i * 5, _draft.minute}.toList()..sort();
    return Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
      _spinner(context, '小时', _draft.hour, List.generate(24, (i) => i),
          (v) => _setDraft(DateTime(_draft.year, _draft.month, _draft.day, v, _draft.minute), syncView: false)),
      const SizedBox(width: 12),
      _spinner(context, '分钟', _draft.minute, minutes,
          (v) => _setDraft(DateTime(_draft.year, _draft.month, _draft.day, _draft.hour, v), syncView: false)),
      const Spacer(),
      CustomPaint(size: const Size(96, 96), painter: _ClockPainter(_draft, c)),
    ]);
  }

  Widget _spinner(BuildContext context, String label, int value, List<int> options, ValueChanged<int> onChanged) {
    final c = context.colors;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(color: c.textMuted, fontSize: AppSize.fsXs)),
      const SizedBox(height: 4),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        decoration: BoxDecoration(
            color: c.surface3, borderRadius: BorderRadius.circular(AppSize.radiusSm), border: Border.all(color: c.borderDefault)),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<int>(
            value: value,
            dropdownColor: c.surface2,
            style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsBase),
            items: [for (final o in options) DropdownMenuItem(value: o, child: Text(pad2(o)))],
            onChanged: (v) => v != null ? onChanged(v) : null,
          ),
        ),
      ),
    ]);
  }

  Widget _presets(BuildContext context) {
    Widget chip(String label, String spec) =>
        HtButton(label: label, variant: HtVariant.ghost, size: HtSize.sm, onPressed: () => _preset(spec));
    return Wrap(spacing: 8, runSpacing: 8, children: [
      chip('1分钟后', '1m'),
      chip('1小时后', '1h'),
      chip('明天9:00', 'tomorrow9'),
      chip('1年后', '1y'),
      chip('2030.01.01', 'y2030'),
    ]);
  }
}

class _ClockPainter extends CustomPainter {
  final DateTime t;
  final SemanticColors c;
  _ClockPainter(this.t, this.c);

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final r = size.width / 2;
    // 表盘
    canvas.drawCircle(center, r - 2, Paint()..color = c.surface3);
    canvas.drawCircle(center, r - 2, Paint()..color = c.borderDefault..style = PaintingStyle.stroke..strokeWidth = 1);
    // 12 个数字
    final tp = TextPainter(textDirection: TextDirection.ltr);
    for (var i = 0; i < 12; i++) {
      final hour = i == 0 ? 12 : i;
      final angle = i * 30 * math.pi / 180;
      final pos = Offset(center.dx + (r - 14) * math.sin(angle), center.dy - (r - 14) * math.cos(angle));
      final active = t.hour % 12 == hour % 12;
      tp.text = TextSpan(
          text: '$hour',
          style: TextStyle(
              color: active ? c.signalPrimary : c.textMuted, fontSize: 10, fontWeight: active ? FontWeight.bold : FontWeight.normal));
      tp.layout();
      tp.paint(canvas, pos - Offset(tp.width / 2, tp.height / 2));
    }
    // 指针
    final hourAngle = ((t.hour % 12) * 30 + t.minute * 0.5) * math.pi / 180;
    final minAngle = (t.minute * 6) * math.pi / 180;
    canvas.drawLine(center, center + Offset(math.sin(hourAngle), -math.cos(hourAngle)) * (r * 0.45),
        Paint()..color = c.textPrimary..strokeWidth = 3..strokeCap = StrokeCap.round);
    canvas.drawLine(center, center + Offset(math.sin(minAngle), -math.cos(minAngle)) * (r * 0.7),
        Paint()..color = c.signalPrimary..strokeWidth = 2..strokeCap = StrokeCap.round);
    canvas.drawCircle(center, 3, Paint()..color = c.signalPrimary);
  }

  @override
  bool shouldRepaint(_ClockPainter old) => old.t != t || old.c != c;
}
