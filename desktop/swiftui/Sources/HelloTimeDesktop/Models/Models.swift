// ============================================================
// 数据模型：对齐 spec/api/openapi.yaml 的 schema（与 React 前端 types/index.ts 一致）。
//
// 日期字段保留 ISO 8601 String，显示时用 DateUtil 解析 —— 避免 10 套后端
// fractional-seconds 写法差异导致解码失败。
// ============================================================

import Foundation

// MARK: - 统一响应外壳

struct Envelope<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let message: String?
    let errorCode: String?
    let details: [FieldError]?
}

struct FieldError: Decodable { let field: String; let message: String }

struct Page<T: Decodable>: Decodable {
    let items: [T]
    let pagination: Pagination
}

struct Pagination: Decodable {
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int
}

// MARK: - 用户 / 头像

struct User: Decodable, Equatable {
    let id: String
    let email: String
    let nickname: String
    let avatarId: String
    let createdAt: String
}

struct UserBrief: Decodable { let nickname: String; let avatarId: String }

struct Avatar: Decodable, Identifiable {
    let id: String
    let name: String
    let primaryColor: String
    let svgUrl: String?
}

// MARK: - 鉴权

struct AuthTokens: Decodable {
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresIn: Int
    let refreshTokenExpiresIn: Int?
    let user: User
}

/// auth/refresh 仅需 token 对（不含 user）。
struct RefreshedTokens: Decodable {
    let accessToken: String
    let refreshToken: String
}

// MARK: - 胶囊

struct CapsuleListItem: Decodable, Identifiable {
    let id: String
    let code: String
    let title: String
    let creator: UserBrief
    let openAt: String
    let createdAt: String
    let inPlaza: Bool
    let favoriteCount: Int
    let isOpened: Bool
    let favoritedByMe: Bool
    let favoritedAt: String?
    let contentPreview: String?
}

struct CapsuleDetail: Decodable, Identifiable {
    let id: String
    let code: String
    let title: String
    let creator: UserBrief
    let openAt: String
    let createdAt: String
    let inPlaza: Bool
    let favoriteCount: Int
    let isOpened: Bool
    let favoritedByMe: Bool
    let content: String?
}

/// 收藏接口返回 `{ capsuleId, favoriteCount, favoritedAt }`。
struct FavoriteResult: Decodable {
    let capsuleId: String
    let favoriteCount: Int
    let favoritedAt: String
}

// MARK: - AI

struct CapsuleSuggestion: Decodable {
    let title: String?
    let content: String
    let openInDays: Int
    let openAt: String
    let generatedBy: String
    let cached: Bool
}

struct CapsuleRecommendation: Decodable, Identifiable {
    let title: String
    let hint: String
    let openInDays: Int
    var id: String { title }
}

struct CapsuleRecommendationList: Decodable {
    let items: [CapsuleRecommendation]
    let generatedBy: String
    let cached: Bool
}

// MARK: - Health（关于页 / 页脚技术栈）

struct StackItem: Decodable, Identifiable {
    let role: String
    let name: String
    let version: String
    let iconUrl: String?
    var id: String { "\(role)-\(name)" }
}

struct HealthStack: Decodable {
    let kind: String
    let summary: String
    let items: [StackItem]
}

struct HealthData: Decodable {
    let status: String
    let service: String
    let version: String
    let uptimeSeconds: Int
    let stack: HealthStack
}

// MARK: - 请求体

struct RegisterRequest: Encodable {
    let email: String; let password: String; let nickname: String; let avatarId: String
}
struct LoginRequest: Encodable { let email: String; let password: String }
struct LogoutRequest: Encodable { let refreshToken: String }
struct RefreshRequest: Encodable { let refreshToken: String }
struct CreateCapsuleRequest: Encodable {
    let title: String; let content: String; let openAt: String; let inPlaza: Bool
}
struct FavoriteRequest: Encodable { let capsuleId: String }
struct CapsuleSuggestionRequest: Encodable { let title: String?; let locale: String? }

struct UpdateProfileRequest: Encodable {
    let nickname: String?
    let avatarId: String?
}
struct ChangePasswordRequest: Encodable {
    let currentPassword: String; let newPassword: String
}
