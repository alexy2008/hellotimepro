import Foundation

/// 收藏 / 取消收藏。favorite_count 是冗余计数器，必须和 favorites 行变更同处一个事务。
/// 并发安全：幂等 UPSERT（ON CONFLICT DO NOTHING RETURNING）判定是否真插入，
/// 配合原子 `favorite_count = favorite_count + 1`，无需行锁也不会重复计数；
/// SQLite 路径由单连接 + BEGIN IMMEDIATE 天然串行。
struct FavoriteService: Sendable {
    let db: AppDatabase
    let capsules: CapsuleRepository
    let favorites: FavoriteRepository

    func addFavorite(_ user: User, _ capsuleIdRaw: String?) async throws -> JSON {
        guard let raw = capsuleIdRaw, let capsuleId = AppDatabase.parseUuid(raw) else {
            throw ApiError.notFound("胶囊不存在")
        }
        return try await db.transaction { sql in
            guard let view = try await capsules.findById(sql, capsuleId) else {
                throw ApiError.notFound("胶囊不存在")
            }
            let capsule = view.capsule
            guard capsule.inPlaza else { throw ApiError.notFound("胶囊不存在") }
            guard capsule.ownerId != user.id else {
                throw ApiError.badRequest("不能收藏自己创建的胶囊")
            }

            let now = Date()
            let inserted = try await favorites.insertIgnore(
                sql, userId: user.id, capsuleId: capsule.id, now: now
            )
            let favoritedAt: Date
            if inserted {
                try await capsules.incrementFavoriteCount(sql, capsule.id, now: now)
                favoritedAt = now
            } else {
                // 幂等：已收藏时返回原收藏时间，计数不变。
                favoritedAt = try await favorites.find(sql, userId: user.id, capsuleId: capsule.id) ?? now
            }
            let count = try await capsules.favoriteCountOf(sql, capsule.id)
            return .object([
                "capsuleId": .string(capsule.id.uuidString.lowercased()),
                "favoriteCount": .int(count),
                "favoritedAt": .string(IsoDate.jsonString(favoritedAt)),
            ])
        }
    }

    /// 取消收藏幂等：胶囊不存在/格式非法/原本未收藏都返回成功（204）。
    func removeFavorite(_ user: User, _ capsuleIdRaw: String) async throws {
        guard let capsuleId = AppDatabase.parseUuid(capsuleIdRaw) else { return }
        try await db.transaction { sql in
            let deleted = try await favorites.delete(sql, userId: user.id, capsuleId: capsuleId)
            if deleted {
                try await capsules.decrementFavoriteCount(sql, capsuleId, now: Date())
            }
        }
    }
}
