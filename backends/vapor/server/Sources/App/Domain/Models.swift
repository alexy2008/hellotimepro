import Foundation

/// 领域模型：与 spec/db/schema.sql 一一对应。UUID / Date 在仓储层做跨库格式转换。

struct User: Sendable {
    let id: UUID
    let email: String
    let passwordHash: String
    let nickname: String
    let avatarId: String
    let createdAt: Date
    let updatedAt: Date
}

struct Capsule: Sendable {
    let id: UUID
    let ownerId: UUID
    let code: String
    let title: String
    let content: String
    let openAt: Date
    let inPlaza: Bool
    let favoriteCount: Int
    let createdAt: Date
    let updatedAt: Date
}

/// 列表/详情查询的联表结果：胶囊 + 创建者摘要（+ 收藏标记/时间）。
struct CapsuleView: Sendable {
    let capsule: Capsule
    let ownerNickname: String
    let ownerAvatarId: String
    var favoritedByMe: Bool = false
    var favoritedAt: Date? = nil
}

struct RefreshTokenRow: Sendable {
    let id: UUID
    let userId: UUID
    let tokenHash: String
    let familyId: UUID
    let expiresAt: Date
    let createdAt: Date
    let revokedAt: Date?
}
