import Foundation

/// 收藏 / 取消收藏。favorite_count 是冗余计数器，必须和 favorites 行变更同处一个事务。
/// PostgreSQL 收藏、取消和删除统一先锁胶囊行；幂等 UPSERT 与原子加减维护计数；
/// SQLite 路径由单连接 + BEGIN IMMEDIATE 天然串行。
struct FavoriteService: Sendable {
    let db: AppDatabase
    let capsules: CapsuleRepository
    let favorites: FavoriteRepository

    func addFavorite(_ user: User, _ capsuleIdRaw: String?) async throws -> JSON {
        let capsuleId = try Validation.capsuleId(capsuleIdRaw)
        return try await db.transaction { sql in
            guard try await capsules.lockOwnerId(sql, capsuleId) != nil else {
                throw ApiError.notFound("胶囊不存在")
            }

            let now = Date()
            let inserted = try await favorites.insertIgnore(
                sql, userId: user.id, capsuleId: capsuleId, now: now
            )
            let favoritedAt: Date
            if inserted {
                try await capsules.incrementFavoriteCount(sql, capsuleId, now: now)
                favoritedAt = now
            } else {
                // 幂等：已收藏时返回原收藏时间，计数不变。
                favoritedAt = try await favorites.find(sql, userId: user.id, capsuleId: capsuleId) ?? now
            }
            let count = try await capsules.favoriteCountOf(sql, capsuleId)
            return .object([
                "capsuleId": .string(capsuleId.uuidString.lowercased()),
                "favoriteCount": .int(count),
                "favoritedAt": .string(IsoDate.jsonString(favoritedAt)),
            ])
        }
    }

    /// 合法 UUID 取消收藏幂等：胶囊不存在/原本未收藏返回 204。
    func removeFavorite(_ user: User, _ capsuleIdRaw: String) async throws {
        let capsuleId = try Validation.capsuleId(capsuleIdRaw)
        try await db.transaction { sql in
            guard try await capsules.lockOwnerId(sql, capsuleId) != nil else { return }
            let deleted = try await favorites.delete(sql, userId: user.id, capsuleId: capsuleId)
            if deleted {
                try await capsules.decrementFavoriteCount(sql, capsuleId, now: Date())
            }
        }
    }
}
