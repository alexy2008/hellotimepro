// 基础单元测试：倒计时与令牌（widget 级 E2E 由 integration_test 覆盖）。
import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:hellotime_flutter/utils/format.dart';
import 'package:hellotime_flutter/theme/tokens.dart';

void main() {
  test('countdownTo 拆分天/时/分/秒', () {
    final target = DateTime.now().add(const Duration(days: 1, hours: 2, minutes: 3, seconds: 4));
    final cd = countdownTo(target);
    expect(cd.expired, false);
    expect(cd.days, 1);
    expect(cd.hours, 2);
    expect(cd.minutes, 3);
  });

  test('已过期 countdown 归零', () {
    final cd = countdownTo(DateTime.now().subtract(const Duration(minutes: 1)));
    expect(cd.expired, true);
    expect(cd.totalSeconds, 0);
  });

  test('令牌：暗色 surface0 与信号青就位', () {
    expect(darkColors.surface0, const Color(0xFF06060C));
    expect(darkColors.signalPrimary, const Color(0xFF14D4F0));
  });
}
