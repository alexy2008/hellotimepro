// 全局 provider：SharedPreferences（main 中 override 注入）、ApiClient 单例。
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/client.dart';

/// main() 加载后用 overrideWithValue 注入真实实例。
final sharedPrefsProvider = Provider<SharedPreferences>((_) => throw UnimplementedError('需在 ProviderScope 注入'));

final apiClientProvider = Provider<ApiClient>((_) => ApiClient());
