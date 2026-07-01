// 8 位胶囊码逐格输入：自动前进 / 退格回退 / 大写过滤。整串粘贴由外部按钮处理。
// = React CapsuleCodeInput.tsx。
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';

const _len = 8;

class CapsuleCodeInput extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onComplete;
  const CapsuleCodeInput({super.key, required this.value, required this.onChanged, this.onComplete});

  @override
  State<CapsuleCodeInput> createState() => _CapsuleCodeInputState();
}

class _CapsuleCodeInputState extends State<CapsuleCodeInput> {
  late final List<TextEditingController> _ctrls;
  late final List<FocusNode> _nodes;

  @override
  void initState() {
    super.initState();
    _ctrls = List.generate(_len, (i) => TextEditingController(text: _charAt(widget.value, i)));
    _nodes = List.generate(_len, (_) => FocusNode());
  }

  @override
  void didUpdateWidget(CapsuleCodeInput old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) {
      for (var i = 0; i < _len; i++) {
        final ch = _charAt(widget.value, i);
        if (_ctrls[i].text != ch) _ctrls[i].text = ch;
      }
    }
  }

  @override
  void dispose() {
    for (final c in _ctrls) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  String _charAt(String s, int i) => i < s.length ? s[i].toUpperCase() : '';

  String _collect() => _ctrls.map((c) => c.text).join();

  void _onCellChanged(int i, String raw) {
    final sanitized = raw.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');
    final ch = sanitized.isEmpty ? '' : sanitized.characters.last;
    _ctrls[i].text = ch;
    final value = _collect();
    widget.onChanged(value);
    if (ch.isNotEmpty && i < _len - 1) _nodes[i + 1].requestFocus();
    if (value.length == _len && !value.contains('')) widget.onComplete?.call(value);
  }

  KeyEventResult _onKey(int i, KeyEvent e) {
    if (e is KeyDownEvent && e.logicalKey == LogicalKeyboardKey.backspace && _ctrls[i].text.isEmpty && i > 0) {
      _nodes[i - 1].requestFocus();
      _ctrls[i - 1].clear();
      widget.onChanged(_collect());
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < _len; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: SizedBox(
              width: 44,
              height: 54,
              child: Focus(
                onKeyEvent: (_, e) => _onKey(i, e),
                child: TextField(
                  controller: _ctrls[i],
                  focusNode: _nodes[i],
                  textAlign: TextAlign.center,
                  textCapitalization: TextCapitalization.characters,
                  maxLength: 1,
                  style: TextStyle(
                      color: c.textPrimary, fontSize: AppSize.fsXl, fontWeight: AppFont.bold, letterSpacing: 1),
                  decoration: InputDecoration(
                    counterText: '',
                    filled: true,
                    fillColor: c.surface3,
                    contentPadding: EdgeInsets.zero,
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppSize.radiusMd),
                        borderSide: BorderSide(color: c.borderDefault)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppSize.radiusMd),
                        borderSide: BorderSide(color: c.signalPrimary, width: 1.5)),
                  ),
                  onChanged: (v) => _onCellChanged(i, v),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
