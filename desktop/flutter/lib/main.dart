// HelloTime Pro · Flutter 桌面端入口。
// 纯 API 消费者：直连反代 :9080，复用既有后端契约（= SwiftUI HelloTimeApp / React main.tsx）。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'router.dart';
import 'stores/auth.dart';
import 'stores/providers.dart';
import 'stores/theme.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const HelloTimeApp(),
    ),
  );
}

class HelloTimeApp extends ConsumerStatefulWidget {
  const HelloTimeApp({super.key});
  @override
  ConsumerState<HelloTimeApp> createState() => _HelloTimeAppState();
}

class _HelloTimeAppState extends ConsumerState<HelloTimeApp> {
  @override
  void initState() {
    super.initState();
    // 启动恢复会话（有 refresh token 则拉 /me）。
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(themeProvider);
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'HelloTime Pro',
      debugShowCheckedModeBanner: false,
      theme: lightAppTheme,
      darkTheme: darkAppTheme,
      themeMode: mode == AppThemeMode.dark ? ThemeMode.dark : ThemeMode.light,
      routerConfig: router,
    );
  }
}
