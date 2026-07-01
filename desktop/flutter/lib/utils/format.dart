// 通用格式化：倒计时 / 时间 / ISO 互转 / 距离文案。
// = React utils/format.ts + SwiftUI DateUtil.swift。

String pad2(int n) => n.toString().padLeft(2, '0');

class Countdown {
  final bool expired;
  final int totalSeconds;
  final int days;
  final int hours;
  final int minutes;
  final int seconds;
  const Countdown({
    required this.expired,
    required this.totalSeconds,
    required this.days,
    required this.hours,
    required this.minutes,
    required this.seconds,
  });
}

DateTime? parseIso(String iso) => DateTime.tryParse(iso)?.toLocal();

Countdown countdownToIso(String iso, [DateTime? now]) {
  final target = DateTime.tryParse(iso);
  if (target == null) {
    return const Countdown(expired: true, totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0);
  }
  return countdownTo(target, now);
}

Countdown countdownTo(DateTime target, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final diffSec = target.difference(n).inSeconds;
  final diff = diffSec < 0 ? 0 : diffSec;
  return Countdown(
    expired: !target.isAfter(n),
    totalSeconds: diff,
    days: diff ~/ 86400,
    hours: (diff % 86400) ~/ 3600,
    minutes: (diff % 3600) ~/ 60,
    seconds: diff % 60,
  );
}

/// "2026年06月21日 14:30"（24h），= zh-CN toLocaleString。
String fmtDateTime(String iso) {
  final d = parseIso(iso);
  if (d == null) return iso;
  return '${d.year}年${pad2(d.month)}月${pad2(d.day)}日 ${pad2(d.hour)}:${pad2(d.minute)}';
}

String fmtDate(String iso) {
  final d = parseIso(iso);
  if (d == null) return iso;
  return '${d.year}年${pad2(d.month)}月${pad2(d.day)}日';
}

/// DateTime → ISO（UTC，提交用）。
String isoFrom(DateTime d) => d.toUtc().toIso8601String();

/// 距离开启的人话（对齐 React DateTimePicker.formatDistance：分钟向上取整）。
String formatDistance(DateTime target, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final diffMs = target.difference(n).inMilliseconds;
  if (diffMs <= 0) return '已到开启时间';
  final minutes = (diffMs / 60000).ceil();
  if (minutes < 60) return '约 $minutes 分钟后';
  final hours = (minutes / 60).floor();
  if (hours < 24) return '约 $hours 小时后';
  final days = (hours / 24).floor();
  if (days < 30) return '约 $days 天后';
  final months = (days / 30).floor();
  if (months < 12) return '约 $months 个月后';
  final years = (days / 365).floor();
  return '约 $years 年后';
}

/// "2026年6月21日 14:30" 触发按钮展示（非零填充月/日，贴近 React formatDisplay）。
String formatDisplay(DateTime d) =>
    '${d.year}年${d.month}月${d.day}日 ${pad2(d.hour)}:${pad2(d.minute)}';
