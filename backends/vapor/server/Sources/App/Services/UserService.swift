import Foundation
import SQLKit

/// 当前用户资料：查看 / 修改昵称头像。对应 Ktor 的 UserService。
struct UserService: Sendable {
    let db: AppDatabase
    let users: UserRepository
    let mapper: MapperService
    let avatars: AvatarService

    func toJson(_ user: User) -> JSON {
        mapper.user(user)
    }

    func updateProfile(_ user: User, _ req: UpdateProfileRequest) async throws -> JSON {
        if req.nickname == nil && req.avatarId == nil {
            throw ApiError.validation("至少提供 nickname 或 avatarId 之一", "body")
        }
        let nickname = try req.nickname.map { try Validation.nickname($0) } ?? user.nickname
        let avatarId = try req.avatarId.map { try Validation.avatarFormat($0) } ?? user.avatarId
        if req.avatarId != nil && !avatars.exists(avatarId) {
            throw ApiError.validation("头像 ID 不存在", "avatarId")
        }

        return try await db.transaction { sql in
            if nickname != user.nickname, try await users.existsByNickname(sql, nickname) {
                throw ApiError.conflict("昵称已被使用", "nickname")
            }
            let now = Date()
            try await users.updateProfile(sql, id: user.id, nickname: nickname, avatarId: avatarId, now: now)
            let updated = User(
                id: user.id, email: user.email, passwordHash: user.passwordHash,
                nickname: nickname, avatarId: avatarId, createdAt: user.createdAt, updatedAt: now
            )
            return mapper.user(updated)
        }
    }
}
