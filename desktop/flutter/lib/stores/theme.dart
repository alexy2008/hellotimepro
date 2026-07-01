// 主题状态：dark/light，持久化到 shared_preferences（= React stores/theme.ts）。
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers.dart';

enum AppThemeMode { dark, light }

class ThemeNotifier extends Notifier<AppThemeMode> {
  static const _key = 'hellotime.theme';

  @override
  AppThemeMode build() {
    final v = ref.read(sharedPrefsProvider).getString(_key);
    return v == 'light' ? AppThemeMode.light : AppThemeMode.dark;
  }

  void toggle() => _set(state == AppThemeMode.dark ? AppThemeMode.light : AppThemeMode.dark);
  void setMode(AppThemeMode m) => _set(m);

  void _set(AppThemeMode m) {
    state = m;
    ref.read(sharedPrefsProvider).setString(_key, m.name);
  }
}

final themeProvider = NotifierProvider<ThemeNotifier, AppThemeMode>(ThemeNotifier.new);
