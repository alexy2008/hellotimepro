// 鉴权状态：access token 内存；refresh token + user 持久化到 shared_preferences。
// 经回调把 token 存取/失效接到 ApiClient（= React stores/auth.ts + configureApi）。
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

class AuthState {
  final User? user;
  final String? accessToken;
  final String? refreshToken;
  final bool hydrated;
  const AuthState({this.user, this.accessToken, this.refreshToken, this.hydrated = false});

  bool get isAuthenticated => user != null;

  AuthState copyWith({User? user, String? accessToken, String? refreshToken, bool? hydrated, bool clearUser = false}) =>
      AuthState(
        user: clearUser ? null : (user ?? this.user),
        accessToken: accessToken,
        refreshToken: refreshToken,
        hydrated: hydrated ?? this.hydrated,
      );
}

class AuthNotifier extends Notifier<AuthState> {
  static const _key = 'hellotime.auth';

  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    api.getAccessToken = () => state.accessToken;
    api.getRefreshToken = () => state.refreshToken;
    api.onTokensRefreshed = (a, r) => patchTokens(a, r);
    api.onAuthLost = _clear;

    // 水合：user + refreshToken（access token 不持久化，靠 refresh 取）
    final raw = ref.read(sharedPrefsProvider).getString(_key);
    if (raw != null) {
      try {
        final j = jsonDecode(raw) as Map<String, dynamic>;
        final u = j['user'] != null ? User.fromJson(j['user'] as Map<String, dynamic>) : null;
        return AuthState(user: u, refreshToken: j['refreshToken'] as String?, hydrated: true);
      } catch (_) {/* 损坏忽略 */}
    }
    return const AuthState(hydrated: true);
  }

  void _persist() {
    final s = state;
    final prefs = ref.read(sharedPrefsProvider);
    if (s.refreshToken == null && s.user == null) {
      prefs.remove(_key);
    } else {
      prefs.setString(_key, jsonEncode({'user': s.user?.toJson(), 'refreshToken': s.refreshToken}));
    }
  }

  void setTokens(AuthTokens t) {
    state = AuthState(user: t.user, accessToken: t.accessToken, refreshToken: t.refreshToken, hydrated: true);
    _persist();
  }

  void patchTokens(String accessToken, String refreshToken) {
    state = state.copyWith(accessToken: accessToken, refreshToken: refreshToken);
    _persist();
  }

  void _clear() {
    state = const AuthState(hydrated: true);
    ref.read(sharedPrefsProvider).remove(_key);
  }

  /// 启动时恢复会话：有 refresh token 就拉 /me（client 会按需 refresh）。
  Future<void> bootstrap() async {
    if (state.refreshToken == null) return;
    await refreshMe();
  }

  Future<void> refreshMe() async {
    try {
      final me = await ref.read(apiClientProvider).me();
      state = state.copyWith(user: me);
      _persist();
    } catch (_) {/* token 失效由 401/onAuthLost 路径接管 */}
  }

  void updateUser(User u) {
    state = state.copyWith(user: u);
    _persist();
  }

  Future<void> logout({bool callServer = true}) async {
    final rt = state.refreshToken;
    state = const AuthState(hydrated: true);
    ref.read(sharedPrefsProvider).remove(_key);
    if (callServer && rt != null) {
      try {
        await ref.read(apiClientProvider).logout(rt);
      } catch (_) {/* 静默 */}
    }
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
