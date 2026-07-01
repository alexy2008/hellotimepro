// ============================================================
// 数据模型：与 spec/api/openapi.yaml 对齐（= React types/index.ts / SwiftUI Models.swift）
// 日期统一存 ISO 字符串，展示/倒计时在 utils/format.dart 里解析。
// ============================================================

/// 字段级校验错误。
class FieldError {
  final String field;
  final String message;
  const FieldError({required this.field, required this.message});
  factory FieldError.fromJson(Map<String, dynamic> j) =>
      FieldError(field: j['field'] as String? ?? '', message: j['message'] as String? ?? '');
}

/// 把响应包装失败映射成异常，便于上层 try/catch（= React ApiError）。
class ApiException implements Exception {
  final String message;
  final int status;
  final String? errorCode;
  final List<FieldError>? details;
  const ApiException(this.message, this.status, [this.errorCode, this.details]);
  @override
  String toString() => message;
}

class Pagination {
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;
  const Pagination({required this.page, required this.pageSize, required this.total, required this.totalPages});
  factory Pagination.fromJson(Map<String, dynamic> j) => Pagination(
        page: j['page'] as int? ?? 1,
        pageSize: j['pageSize'] as int? ?? 0,
        total: j['total'] as int? ?? 0,
        totalPages: j['totalPages'] as int? ?? 0,
      );
}

class Avatar {
  final String id;
  final String name;
  final String primaryColor;
  final String? svgUrl;
  const Avatar({required this.id, required this.name, required this.primaryColor, this.svgUrl});
  factory Avatar.fromJson(Map<String, dynamic> j) => Avatar(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        primaryColor: j['primaryColor'] as String? ?? '#6b46ff',
        svgUrl: j['svgUrl'] as String?,
      );
}

class UserBrief {
  final String nickname;
  final String avatarId;
  const UserBrief({required this.nickname, required this.avatarId});
  factory UserBrief.fromJson(Map<String, dynamic> j) =>
      UserBrief(nickname: j['nickname'] as String? ?? '', avatarId: j['avatarId'] as String? ?? '');
}

class User {
  final String id;
  final String email;
  final String nickname;
  final String avatarId;
  final String createdAt;
  const User({
    required this.id,
    required this.email,
    required this.nickname,
    required this.avatarId,
    required this.createdAt,
  });
  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        email: j['email'] as String? ?? '',
        nickname: j['nickname'] as String? ?? '',
        avatarId: j['avatarId'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
      );
  Map<String, dynamic> toJson() =>
      {'id': id, 'email': email, 'nickname': nickname, 'avatarId': avatarId, 'createdAt': createdAt};
}

/// 列表项与详情共享的基础字段。
class CapsuleListItem {
  final String id;
  final String code;
  final String title;
  final UserBrief creator;
  final String openAt;
  final String createdAt;
  final bool inPlaza;
  final int favoriteCount;
  final bool isOpened;
  final bool favoritedByMe;
  final String? favoritedAt;
  final String? contentPreview;
  const CapsuleListItem({
    required this.id,
    required this.code,
    required this.title,
    required this.creator,
    required this.openAt,
    required this.createdAt,
    required this.inPlaza,
    required this.favoriteCount,
    required this.isOpened,
    required this.favoritedByMe,
    this.favoritedAt,
    this.contentPreview,
  });
  factory CapsuleListItem.fromJson(Map<String, dynamic> j) => CapsuleListItem(
        id: j['id'] as String,
        code: j['code'] as String? ?? '',
        title: j['title'] as String? ?? '',
        creator: UserBrief.fromJson(j['creator'] as Map<String, dynamic>),
        openAt: j['openAt'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
        inPlaza: j['inPlaza'] as bool? ?? false,
        favoriteCount: j['favoriteCount'] as int? ?? 0,
        isOpened: j['isOpened'] as bool? ?? false,
        favoritedByMe: j['favoritedByMe'] as bool? ?? false,
        favoritedAt: j['favoritedAt'] as String?,
        contentPreview: j['contentPreview'] as String?,
      );
}

class CapsuleDetail {
  final String id;
  final String code;
  final String title;
  final UserBrief creator;
  final String openAt;
  final String createdAt;
  final bool inPlaza;
  final int favoriteCount;
  final bool isOpened;
  final bool favoritedByMe;
  final String? content;
  const CapsuleDetail({
    required this.id,
    required this.code,
    required this.title,
    required this.creator,
    required this.openAt,
    required this.createdAt,
    required this.inPlaza,
    required this.favoriteCount,
    required this.isOpened,
    required this.favoritedByMe,
    this.content,
  });
  factory CapsuleDetail.fromJson(Map<String, dynamic> j) => CapsuleDetail(
        id: j['id'] as String,
        code: j['code'] as String? ?? '',
        title: j['title'] as String? ?? '',
        creator: UserBrief.fromJson(j['creator'] as Map<String, dynamic>),
        openAt: j['openAt'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
        inPlaza: j['inPlaza'] as bool? ?? false,
        favoriteCount: j['favoriteCount'] as int? ?? 0,
        isOpened: j['isOpened'] as bool? ?? false,
        favoritedByMe: j['favoritedByMe'] as bool? ?? false,
        content: j['content'] as String?,
      );

  CapsuleDetail copyWith({int? favoriteCount, bool? favoritedByMe, bool? isOpened, String? content}) => CapsuleDetail(
        id: id,
        code: code,
        title: title,
        creator: creator,
        openAt: openAt,
        createdAt: createdAt,
        inPlaza: inPlaza,
        favoriteCount: favoriteCount ?? this.favoriteCount,
        isOpened: isOpened ?? this.isOpened,
        favoritedByMe: favoritedByMe ?? this.favoritedByMe,
        content: content ?? this.content,
      );
}

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final int accessTokenExpiresIn;
  final int? refreshTokenExpiresIn;
  final User user;
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresIn,
    this.refreshTokenExpiresIn,
    required this.user,
  });
  factory AuthTokens.fromJson(Map<String, dynamic> j) => AuthTokens(
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String,
        accessTokenExpiresIn: j['accessTokenExpiresIn'] as int? ?? 0,
        refreshTokenExpiresIn: j['refreshTokenExpiresIn'] as int?,
        user: User.fromJson(j['user'] as Map<String, dynamic>),
      );
}

/// /auth/refresh 的 data（仅 token 对）。
class RefreshedTokens {
  final String accessToken;
  final String refreshToken;
  const RefreshedTokens({required this.accessToken, required this.refreshToken});
  factory RefreshedTokens.fromJson(Map<String, dynamic> j) =>
      RefreshedTokens(accessToken: j['accessToken'] as String, refreshToken: j['refreshToken'] as String);
}

class StackItem {
  final String role;
  final String name;
  final String version;
  final String? iconUrl;
  const StackItem({required this.role, required this.name, required this.version, this.iconUrl});
  factory StackItem.fromJson(Map<String, dynamic> j) => StackItem(
        role: j['role'] as String? ?? '',
        name: j['name'] as String? ?? '',
        version: j['version'] as String? ?? '',
        iconUrl: j['iconUrl'] as String?,
      );
}

class StackInfo {
  final String kind;
  final String summary;
  final List<StackItem> items;
  const StackInfo({required this.kind, required this.summary, required this.items});
  factory StackInfo.fromJson(Map<String, dynamic> j) => StackInfo(
        kind: j['kind'] as String? ?? '',
        summary: j['summary'] as String? ?? '',
        items: (j['items'] as List<dynamic>? ?? []).map((e) => StackItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class HealthData {
  final String status;
  final String service;
  final String version;
  final int uptimeSeconds;
  final StackInfo stack;
  const HealthData({
    required this.status,
    required this.service,
    required this.version,
    required this.uptimeSeconds,
    required this.stack,
  });
  factory HealthData.fromJson(Map<String, dynamic> j) => HealthData(
        status: j['status'] as String? ?? 'ok',
        service: j['service'] as String? ?? '',
        version: j['version'] as String? ?? '',
        uptimeSeconds: j['uptimeSeconds'] as int? ?? 0,
        stack: StackInfo.fromJson(j['stack'] as Map<String, dynamic>),
      );
}

class CapsuleSuggestion {
  final String? title;
  final String content;
  final int openInDays;
  final String openAt;
  final String generatedBy;
  final bool cached;
  const CapsuleSuggestion({
    this.title,
    required this.content,
    required this.openInDays,
    required this.openAt,
    required this.generatedBy,
    required this.cached,
  });
  factory CapsuleSuggestion.fromJson(Map<String, dynamic> j) => CapsuleSuggestion(
        title: j['title'] as String?,
        content: j['content'] as String? ?? '',
        openInDays: j['openInDays'] as int? ?? 0,
        openAt: j['openAt'] as String? ?? '',
        generatedBy: j['generatedBy'] as String? ?? '',
        cached: j['cached'] as bool? ?? false,
      );
}

class CapsuleRecommendation {
  final String title;
  final String hint;
  final int openInDays;
  const CapsuleRecommendation({required this.title, required this.hint, required this.openInDays});
  factory CapsuleRecommendation.fromJson(Map<String, dynamic> j) => CapsuleRecommendation(
        title: j['title'] as String? ?? '',
        hint: j['hint'] as String? ?? '',
        openInDays: j['openInDays'] as int? ?? 0,
      );
}

class CapsuleRecommendationList {
  final List<CapsuleRecommendation> items;
  final String generatedBy;
  final bool cached;
  const CapsuleRecommendationList({required this.items, required this.generatedBy, required this.cached});
  factory CapsuleRecommendationList.fromJson(Map<String, dynamic> j) => CapsuleRecommendationList(
        items: (j['items'] as List<dynamic>? ?? [])
            .map((e) => CapsuleRecommendation.fromJson(e as Map<String, dynamic>))
            .toList(),
        generatedBy: j['generatedBy'] as String? ?? '',
        cached: j['cached'] as bool? ?? false,
      );
}

class PaginatedCapsules {
  final List<CapsuleListItem> items;
  final Pagination pagination;
  const PaginatedCapsules({required this.items, required this.pagination});
  factory PaginatedCapsules.fromJson(Map<String, dynamic> j) => PaginatedCapsules(
        items: (j['items'] as List<dynamic>? ?? [])
            .map((e) => CapsuleListItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        pagination: Pagination.fromJson(j['pagination'] as Map<String, dynamic>),
      );
}

class FavoriteResult {
  final String capsuleId;
  final int favoriteCount;
  final String favoritedAt;
  const FavoriteResult({required this.capsuleId, required this.favoriteCount, required this.favoritedAt});
  factory FavoriteResult.fromJson(Map<String, dynamic> j) => FavoriteResult(
        capsuleId: j['capsuleId'] as String? ?? '',
        favoriteCount: j['favoriteCount'] as int? ?? 0,
        favoritedAt: j['favoritedAt'] as String? ?? '',
      );
}

// ---------- 请求体 ----------

class CreateCapsuleRequest {
  final String title;
  final String content;
  final String openAt;
  final bool inPlaza;
  const CreateCapsuleRequest({required this.title, required this.content, required this.openAt, this.inPlaza = true});
  Map<String, dynamic> toJson() => {'title': title, 'content': content, 'openAt': openAt, 'inPlaza': inPlaza};
}

class RegisterRequest {
  final String email;
  final String password;
  final String nickname;
  final String avatarId;
  const RegisterRequest({required this.email, required this.password, required this.nickname, required this.avatarId});
  Map<String, dynamic> toJson() => {'email': email, 'password': password, 'nickname': nickname, 'avatarId': avatarId};
}

class LoginRequest {
  final String email;
  final String password;
  const LoginRequest({required this.email, required this.password});
  Map<String, dynamic> toJson() => {'email': email, 'password': password};
}

class UpdateProfileRequest {
  final String? nickname;
  final String? avatarId;
  const UpdateProfileRequest({this.nickname, this.avatarId});
  Map<String, dynamic> toJson() => {
        if (nickname != null) 'nickname': nickname,
        if (avatarId != null) 'avatarId': avatarId,
      };
}

class ChangePasswordRequest {
  final String currentPassword;
  final String newPassword;
  const ChangePasswordRequest({required this.currentPassword, required this.newPassword});
  Map<String, dynamic> toJson() => {'currentPassword': currentPassword, 'newPassword': newPassword};
}
