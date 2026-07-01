// ============================================================
// API 客户端：拼 URL、解 Envelope、自动 refresh（单飞）+ 401 重放。
// = React api/client.ts / SwiftUI APIClient.swift。
//
// 原生无 Vite 代理，直连反代 :9080；可用 --dart-define=API_BASE=… 覆盖。
// access token 由 auth store 存内存；refresh token 存内存 + shared_preferences。
// token 存取与失效经回调注入，避免与 store 循环依赖。
// ============================================================

import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/models.dart';

const String _apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://127.0.0.1:9080');

class ApiClient {
  ApiClient({String? baseUrl}) : base = baseUrl ?? _apiBase;

  final String base;
  final http.Client _client = http.Client();

  // 由 auth store 注册的回调
  String? Function() getAccessToken = () => null;
  String? Function() getRefreshToken = () => null;
  void Function(String accessToken, String refreshToken) onTokensRefreshed = (_, _) {};
  void Function() onAuthLost = () {};

  // ---------- 资源 URL ----------
  String avatarUrl(String id) => '$base/static/avatars/$id.svg';

  /// 相对资源（如 health 里的 iconUrl）补全为绝对地址。
  String resolveAsset(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$base${url.startsWith('/') ? '' : '/'}$url';
  }

  // ---------- refresh 单飞 ----------
  Future<String?>? _refreshing;

  Future<String?> _tryRefresh() {
    final existing = _refreshing;
    if (existing != null) return existing;
    final rt = getRefreshToken();
    if (rt == null) return Future.value(null);
    final future = _doRefresh(rt);
    _refreshing = future;
    return future;
  }

  Future<String?> _doRefresh(String refreshToken) async {
    try {
      final res = await _client.post(
        Uri.parse('$base/api/v1/auth/refresh'),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      final env = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      if (res.statusCode != 200 || env['success'] != true || env['data'] == null) {
        onAuthLost();
        return null;
      }
      final tok = RefreshedTokens.fromJson(env['data'] as Map<String, dynamic>);
      onTokensRefreshed(tok.accessToken, tok.refreshToken);
      return tok.accessToken;
    } catch (_) {
      onAuthLost();
      return null;
    } finally {
      _refreshing = null;
    }
  }

  Future<String?> _accessTokenForRequest(bool useAuth) async {
    if (!useAuth) return null;
    final at = getAccessToken();
    if (at != null) return at;
    return _tryRefresh();
  }

  bool _shouldRefresh(int status, Object? errorCode, bool useAuth, bool retry) =>
      status == 401 && errorCode == 'UNAUTHORIZED' && useAuth && !retry && getRefreshToken() != null;

  // ---------- 通用请求 ----------
  Future<T> _request<T>(
    String method,
    String path, {
    Object? body,
    bool auth = true,
    required T Function(Object? data) parse,
    bool retry = false,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    final token = await _accessTokenForRequest(auth);
    if (token != null) headers['Authorization'] = 'Bearer $token';

    final req = http.Request(method, Uri.parse('$base$path'));
    req.headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _client.send(req));

    if (res.statusCode == 204) return parse(null);

    Map<String, dynamic> env;
    try {
      env = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('响应解析失败', res.statusCode, 'INTERNAL_ERROR');
    }

    final success = env['success'] == true;
    if (res.statusCode >= 400 || !success) {
      if (_shouldRefresh(res.statusCode, env['errorCode'], auth, retry)) {
        final newToken = await _tryRefresh();
        if (newToken != null) {
          return _request<T>(method, path, body: body, auth: auth, parse: parse, retry: true);
        }
      }
      final details = (env['details'] as List<dynamic>?)
          ?.map((e) => FieldError.fromJson(e as Map<String, dynamic>))
          .toList();
      throw ApiException(env['message'] as String? ?? '请求失败', res.statusCode, env['errorCode'] as String?, details);
    }
    return parse(env['data']);
  }

  String _qs(Map<String, String?> params) {
    final entries = params.entries.where((e) => e.value != null && e.value!.isNotEmpty);
    if (entries.isEmpty) return '';
    return '?${entries.map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value!)}').join('&')}';
  }

  // ---------- 端点 ----------
  Future<HealthData> health() =>
      _request('GET', '/api/v1/health', auth: false, parse: (d) => HealthData.fromJson(d as Map<String, dynamic>));

  Future<CapsuleSuggestion> suggestCapsule({String? title, String? locale}) => _request(
        'POST',
        '/api/v1/capsule-suggestion',
        auth: false,
        body: {if (title != null && title.isNotEmpty) 'title': title, 'locale': ?locale},
        parse: (d) => CapsuleSuggestion.fromJson(d as Map<String, dynamic>),
      );

  Future<CapsuleRecommendationList> capsuleRecommendations({int? count, String? locale}) => _request(
        'GET',
        '/api/v1/capsule-recommendations${_qs({'count': count?.toString(), 'locale': locale})}',
        auth: false,
        parse: (d) => CapsuleRecommendationList.fromJson(d as Map<String, dynamic>),
      );

  Future<List<Avatar>> avatars() => _request(
        'GET',
        '/api/v1/avatars',
        auth: false,
        parse: (d) => (d as List<dynamic>).map((e) => Avatar.fromJson(e as Map<String, dynamic>)).toList(),
      );

  // 鉴权
  Future<AuthTokens> register(RegisterRequest body) => _request('POST', '/api/v1/auth/register',
      auth: false, body: body.toJson(), parse: (d) => AuthTokens.fromJson(d as Map<String, dynamic>));

  Future<AuthTokens> login(LoginRequest body) => _request('POST', '/api/v1/auth/login',
      auth: false, body: body.toJson(), parse: (d) => AuthTokens.fromJson(d as Map<String, dynamic>));

  Future<void> logout(String? refreshToken) => _request<void>('POST', '/api/v1/auth/logout',
      auth: false, body: refreshToken != null ? {'refreshToken': refreshToken} : {}, parse: (_) {});

  // 当前用户
  Future<User> me() => _request('GET', '/api/v1/me', parse: (d) => User.fromJson(d as Map<String, dynamic>));

  Future<User> updateProfile(UpdateProfileRequest body) =>
      _request('PATCH', '/api/v1/me', body: body.toJson(), parse: (d) => User.fromJson(d as Map<String, dynamic>));

  Future<void> changePassword(ChangePasswordRequest body) =>
      _request<void>('POST', '/api/v1/me/password', body: body.toJson(), parse: (_) {});

  // 胶囊
  Future<CapsuleDetail> createCapsule(CreateCapsuleRequest body) => _request('POST', '/api/v1/capsules',
      body: body.toJson(), parse: (d) => CapsuleDetail.fromJson(d as Map<String, dynamic>));

  Future<CapsuleDetail> capsuleByCode(String code) => _request(
        'GET',
        '/api/v1/capsules/${Uri.encodeComponent(code)}',
        parse: (d) => CapsuleDetail.fromJson(d as Map<String, dynamic>),
      );

  // 广场
  Future<PaginatedCapsules> plaza({String? sort, String? filter, String? q, int? page, int? pageSize}) => _request(
        'GET',
        '/api/v1/plaza/capsules${_qs({
              'sort': sort,
              'filter': filter,
              'q': q,
              'page': page?.toString(),
              'pageSize': pageSize?.toString(),
            })}',
        parse: (d) => PaginatedCapsules.fromJson(d as Map<String, dynamic>),
      );

  // 我创建的
  Future<PaginatedCapsules> myCapsules({int page = 1, int pageSize = 20}) => _request(
        'GET',
        '/api/v1/me/capsules?page=$page&pageSize=$pageSize',
        parse: (d) => PaginatedCapsules.fromJson(d as Map<String, dynamic>),
      );

  Future<void> deleteMyCapsule(String id) =>
      _request<void>('DELETE', '/api/v1/me/capsules/${Uri.encodeComponent(id)}', parse: (_) {});

  // 收藏
  Future<PaginatedCapsules> myFavorites({int page = 1, int pageSize = 20}) => _request(
        'GET',
        '/api/v1/me/favorites?page=$page&pageSize=$pageSize',
        parse: (d) => PaginatedCapsules.fromJson(d as Map<String, dynamic>),
      );

  Future<FavoriteResult> favorite(String capsuleId) => _request('POST', '/api/v1/me/favorites',
      body: {'capsuleId': capsuleId}, parse: (d) => FavoriteResult.fromJson(d as Map<String, dynamic>));

  Future<void> unfavorite(String capsuleId) =>
      _request<void>('DELETE', '/api/v1/me/favorites/${Uri.encodeComponent(capsuleId)}', parse: (_) {});
}
