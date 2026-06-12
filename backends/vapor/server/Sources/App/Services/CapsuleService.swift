import Foundation
import SQLKit

/// 胶囊创建 / 按码查询 / 广场详情 / 删除。对应 Ktor 的 CapsuleService。
struct CapsuleService: Sendable {
    static let codeAlphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

    let db: AppDatabase
    let capsules: CapsuleRepository
    let favorites: FavoriteRepository
    let mapper: MapperService

    func create(_ owner: User, _ req: CreateCapsuleRequest) async throws -> JSON {
        let title = try Validation.title(req.title)
        let content = try Validation.content(req.content)
        let openAt = try Validation.openAt(req.openAt)
        let now = Date()
        if openAt < now.addingTimeInterval(60) {
            throw ApiError.validation("openAt 必须晚于当前时间 60 秒以上", "openAt")
        }
        var utcCal = Calendar(identifier: .gregorian)
        utcCal.timeZone = TimeZone(identifier: "UTC")!
        let tenYears = utcCal.date(byAdding: .year, value: 10, to: now)!
        if openAt > tenYears {
            throw ApiError.validation("openAt 不得超出当前时间 10 年", "openAt")
        }
        let inPlaza = req.inPlaza ?? true

        return try await db.transaction { sql in
            var code = ""
            for _ in 0..<5 {
                let candidate = Self.generateCode()
                if try await !capsules.existsByCode(sql, candidate) {
                    code = candidate
                    break
                }
            }
            guard !code.isEmpty else {
                throw ApiError(status: .internalServerError, code: "INTERNAL_ERROR",
                               message: "生成唯一码失败", details: nil)
            }
            let capsule = Capsule(
                id: UUID(), ownerId: owner.id, code: code, title: title, content: content,
                openAt: openAt, inPlaza: inPlaza, favoriteCount: 0, createdAt: now, updatedAt: now
            )
            try await capsules.insert(sql, capsule)
            let view = CapsuleView(capsule: capsule, ownerNickname: owner.nickname,
                                   ownerAvatarId: owner.avatarId)
            return mapper.detail(view, favoritedByMe: false)
        }
    }

    /// 按 8 位码查询：凭码即可见（包括 inPlaza=false），大小写不敏感。
    func getByCode(_ code: String, viewerId: UUID?) async throws -> JSON {
        try Validation.code(code)
        let upper = code.uppercased()
        return try await db.withSQL { sql in
            guard let view = try await capsules.findByCode(sql, upper) else {
                throw ApiError.notFound("胶囊不存在")
            }
            let favorited = try await isFavorited(sql, viewerId: viewerId, capsuleId: view.capsule.id)
            return mapper.detail(view, favoritedByMe: favorited)
        }
    }

    /// 广场详情：仅 inPlaza=true；非法 UUID / 不在广场 → 404。
    func getPlazaDetail(_ idRaw: String, viewerId: UUID?) async throws -> JSON {
        guard let id = AppDatabase.parseUuid(idRaw) else {
            throw ApiError.notFound("胶囊不存在")
        }
        return try await db.withSQL { sql in
            guard let view = try await capsules.findById(sql, id), view.capsule.inPlaza else {
                throw ApiError.notFound("胶囊不存在")
            }
            let favorited = try await isFavorited(sql, viewerId: viewerId, capsuleId: view.capsule.id)
            return mapper.detail(view, favoritedByMe: favorited)
        }
    }

    /// 删除自己的胶囊（无论是否到期）；连同收藏关系一起删。
    func deleteOwn(_ user: User, _ idRaw: String) async throws {
        guard let id = AppDatabase.parseUuid(idRaw) else {
            throw ApiError.notFound("胶囊不存在")
        }
        try await db.transaction { sql in
            guard let view = try await capsules.findById(sql, id) else {
                throw ApiError.notFound("胶囊不存在")
            }
            guard view.capsule.ownerId == user.id else {
                throw ApiError.forbidden("无权删除他人胶囊")
            }
            try await favorites.deleteByCapsule(sql, id)
            try await capsules.delete(sql, id)
        }
    }

    private func isFavorited(_ sql: any SQLDatabase, viewerId: UUID?, capsuleId: UUID) async throws -> Bool {
        guard let viewerId else { return false }
        return try await favorites.exists(sql, userId: viewerId, capsuleId: capsuleId)
    }

    static func generateCode() -> String {
        String((0..<8).map { _ in codeAlphabet.randomElement()! })
    }
}
