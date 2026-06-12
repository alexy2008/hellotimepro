import Vapor

/// 请求体 DTO：字段全部可选，缺失/为 null 都先收下来，由 Validation 统一裁决
/// （这样"缺字段"也能返回契约要求的 422 + details，而不是解码层 4xx）。

struct RegisterRequest: Content {
    var email: String?
    var password: String?
    var nickname: String?
    var avatarId: String?
}

struct LoginRequest: Content {
    var email: String?
    var password: String?
}

struct RefreshRequest: Content {
    var refreshToken: String?
}

struct LogoutRequest: Content {
    var refreshToken: String?
}

struct UpdateProfileRequest: Content {
    var nickname: String?
    var avatarId: String?
}

struct ChangePasswordRequest: Content {
    var currentPassword: String?
    var newPassword: String?
}

struct CreateCapsuleRequest: Content {
    var title: String?
    var content: String?
    var openAt: String?
    var inPlaza: Bool?
}

struct FavoriteRequest: Content {
    var capsuleId: String?
}

struct CapsuleSuggestionRequest: Content {
    var title: String?
    var locale: String?
}
