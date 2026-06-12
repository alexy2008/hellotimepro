import Foundation
import SQLKit

/// 仓储层：手写 SQL（SQLKit 参数绑定），跨库差异通过 AppDatabase 的值编解码助手抹平。
/// 方法都接收当前连接的 `SQLDatabase`——事务边界由 service 层的
/// `db.transaction { sql in ... }` 决定，仓储自身不开事务。

struct UserRepository {
    let dbx: AppDatabase

    private func map(_ row: SQLRow) throws -> User {
        User(
            id: try dbx.uuid(row, "id"),
            email: try row.decode(column: "email", as: String.self),
            passwordHash: try row.decode(column: "password_hash", as: String.self),
            nickname: try row.decode(column: "nickname", as: String.self),
            avatarId: try row.decode(column: "avatar_id", as: String.self),
            createdAt: try dbx.date(row, "created_at"),
            updatedAt: try dbx.date(row, "updated_at")
        )
    }

    func findByEmail(_ sql: any SQLDatabase, _ email: String) async throws -> User? {
        try await sql.raw("SELECT * FROM users WHERE email = \(bind: email)")
            .first().map { try map($0) }
    }

    func findById(_ sql: any SQLDatabase, _ id: UUID) async throws -> User? {
        try await sql.raw("SELECT * FROM users WHERE id = \(bind: dbx.uuidValue(id))")
            .first().map { try map($0) }
    }

    func existsByEmail(_ sql: any SQLDatabase, _ email: String) async throws -> Bool {
        try await sql.raw("SELECT 1 FROM users WHERE email = \(bind: email) LIMIT 1")
            .first() != nil
    }

    func existsByNickname(_ sql: any SQLDatabase, _ nickname: String) async throws -> Bool {
        try await sql.raw("SELECT 1 FROM users WHERE nickname = \(bind: nickname) LIMIT 1")
            .first() != nil
    }

    func insert(_ sql: any SQLDatabase, _ user: User) async throws {
        try await sql.raw("""
            INSERT INTO users (id, email, password_hash, nickname, avatar_id, created_at, updated_at)
            VALUES (\(bind: dbx.uuidValue(user.id)), \(bind: user.email), \(bind: user.passwordHash),
                    \(bind: user.nickname), \(bind: user.avatarId),
                    \(bind: dbx.dateValue(user.createdAt)), \(bind: dbx.dateValue(user.updatedAt)))
            """).run()
    }

    func updateProfile(_ sql: any SQLDatabase, id: UUID, nickname: String, avatarId: String, now: Date) async throws {
        try await sql.raw("""
            UPDATE users SET nickname = \(bind: nickname), avatar_id = \(bind: avatarId),
                   updated_at = \(bind: dbx.dateValue(now))
            WHERE id = \(bind: dbx.uuidValue(id))
            """).run()
    }

    func updatePassword(_ sql: any SQLDatabase, id: UUID, passwordHash: String, now: Date) async throws {
        try await sql.raw("""
            UPDATE users SET password_hash = \(bind: passwordHash), updated_at = \(bind: dbx.dateValue(now))
            WHERE id = \(bind: dbx.uuidValue(id))
            """).run()
    }
}

enum PlazaSort {
    case hot, new
}

enum PlazaFilter {
    case all, opened, unopened
}

struct CapsuleRepository {
    let dbx: AppDatabase

    /// 联表查询的公共列：胶囊全列 + 创建者摘要。
    private static let viewColumns = """
        c.id, c.owner_id, c.code, c.title, c.content, c.open_at, c.in_plaza,
        c.favorite_count, c.created_at, c.updated_at,
        u.nickname AS owner_nickname, u.avatar_id AS owner_avatar_id
        """

    private func mapView(_ row: SQLRow, favoritedColumn: Bool = false, favoritedAtColumn: Bool = false) throws -> CapsuleView {
        let capsule = Capsule(
            id: try dbx.uuid(row, "id"),
            ownerId: try dbx.uuid(row, "owner_id"),
            code: try row.decode(column: "code", as: String.self),
            title: try row.decode(column: "title", as: String.self),
            content: try row.decode(column: "content", as: String.self),
            openAt: try dbx.date(row, "open_at"),
            inPlaza: try dbx.bool(row, "in_plaza"),
            favoriteCount: try row.decode(column: "favorite_count", as: Int.self),
            createdAt: try dbx.date(row, "created_at"),
            updatedAt: try dbx.date(row, "updated_at")
        )
        return CapsuleView(
            capsule: capsule,
            ownerNickname: try row.decode(column: "owner_nickname", as: String.self),
            ownerAvatarId: try row.decode(column: "owner_avatar_id", as: String.self),
            favoritedByMe: favoritedColumn ? try dbx.bool(row, "favorited_by_me") : false,
            favoritedAt: favoritedAtColumn ? try dbx.dateOrNil(row, "favorited_at") : nil
        )
    }

    func findByCode(_ sql: any SQLDatabase, _ code: String) async throws -> CapsuleView? {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT \(Self.viewColumns) FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.code = ")
        q.appendInterpolation(bind: code)
        return try await sql.raw(q).first().map { try mapView($0) }
    }

    func findById(_ sql: any SQLDatabase, _ id: UUID) async throws -> CapsuleView? {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT \(Self.viewColumns) FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.id = ")
        q.appendInterpolation(bind: dbx.uuidValue(id))
        return try await sql.raw(q).first().map { try mapView($0) }
    }

    func existsByCode(_ sql: any SQLDatabase, _ code: String) async throws -> Bool {
        try await sql.raw("SELECT 1 FROM capsules WHERE code = \(bind: code) LIMIT 1").first() != nil
    }

    func insert(_ sql: any SQLDatabase, _ c: Capsule) async throws {
        try await sql.raw("""
            INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza,
                                  favorite_count, created_at, updated_at)
            VALUES (\(bind: dbx.uuidValue(c.id)), \(bind: dbx.uuidValue(c.ownerId)), \(bind: c.code),
                    \(bind: c.title), \(bind: c.content), \(bind: dbx.dateValue(c.openAt)),
                    \(bind: dbx.boolValue(c.inPlaza)), \(bind: c.favoriteCount),
                    \(bind: dbx.dateValue(c.createdAt)), \(bind: dbx.dateValue(c.updatedAt)))
            """).run()
    }

    func delete(_ sql: any SQLDatabase, _ id: UUID) async throws {
        try await sql.raw("DELETE FROM capsules WHERE id = \(bind: dbx.uuidValue(id))").run()
    }

    func incrementFavoriteCount(_ sql: any SQLDatabase, _ id: UUID, now: Date) async throws {
        try await sql.raw("""
            UPDATE capsules SET favorite_count = favorite_count + 1, updated_at = \(bind: dbx.dateValue(now))
            WHERE id = \(bind: dbx.uuidValue(id))
            """).run()
    }

    func decrementFavoriteCount(_ sql: any SQLDatabase, _ id: UUID, now: Date) async throws {
        try await sql.raw("""
            UPDATE capsules SET favorite_count = favorite_count - 1, updated_at = \(bind: dbx.dateValue(now))
            WHERE id = \(bind: dbx.uuidValue(id)) AND favorite_count > 0
            """).run()
    }

    func favoriteCountOf(_ sql: any SQLDatabase, _ id: UUID) async throws -> Int {
        guard let row = try await sql.raw(
            "SELECT favorite_count FROM capsules WHERE id = \(bind: dbx.uuidValue(id))"
        ).first() else { return 0 }
        return try row.decode(column: "favorite_count", as: Int.self)
    }

    // ── 广场 ───────────────────────────────────────────────────────────────

    /// WHERE 子句公共部分：in_plaza + filter + q。
    private func appendPlazaConditions(
        _ q: inout SQLQueryString, filter: PlazaFilter, now: Date, search: String?
    ) {
        q.appendLiteral(" WHERE c.in_plaza = ")
        q.appendInterpolation(bind: dbx.boolValue(true))
        switch filter {
        case .all: break
        case .opened:
            q.appendLiteral(" AND c.open_at <= ")
            q.appendInterpolation(bind: dbx.dateValue(now))
        case .unopened:
            q.appendLiteral(" AND c.open_at > ")
            q.appendInterpolation(bind: dbx.dateValue(now))
        }
        if let search {
            let pattern = "%\(search)%"
            q.appendLiteral(" AND (lower(c.title) LIKE ")
            q.appendInterpolation(bind: pattern)
            q.appendLiteral(" OR lower(u.nickname) LIKE ")
            q.appendInterpolation(bind: pattern)
            q.appendLiteral(")")
        }
    }

    func countPlaza(_ sql: any SQLDatabase, filter: PlazaFilter, now: Date, search: String?) async throws -> Int {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT COUNT(*) AS total FROM capsules c JOIN users u ON u.id = c.owner_id")
        appendPlazaConditions(&q, filter: filter, now: now, search: search)
        guard let row = try await sql.raw(q).first() else { return 0 }
        return try row.decode(column: "total", as: Int.self)
    }

    func findPlazaPage(
        _ sql: any SQLDatabase,
        filter: PlazaFilter, now: Date, search: String?, sort: PlazaSort,
        viewerId: UUID?, limit: Int, offset: Int
    ) async throws -> [CapsuleView] {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT \(Self.viewColumns), ")
        if let viewerId {
            q.appendLiteral("(fv.user_id IS NOT NULL) AS favorited_by_me ")
            q.appendLiteral("FROM capsules c JOIN users u ON u.id = c.owner_id ")
            q.appendLiteral("LEFT JOIN favorites fv ON fv.capsule_id = c.id AND fv.user_id = ")
            q.appendInterpolation(bind: dbx.uuidValue(viewerId))
        } else {
            q.appendLiteral("(1 = 0) AS favorited_by_me ")
            q.appendLiteral("FROM capsules c JOIN users u ON u.id = c.owner_id")
        }
        appendPlazaConditions(&q, filter: filter, now: now, search: search)
        switch sort {
        case .hot: q.appendLiteral(" ORDER BY c.favorite_count DESC, c.created_at DESC")
        case .new: q.appendLiteral(" ORDER BY c.created_at DESC")
        }
        q.appendLiteral(" LIMIT ")
        q.appendInterpolation(bind: limit)
        q.appendLiteral(" OFFSET ")
        q.appendInterpolation(bind: offset)
        return try await sql.raw(q).all().map { try mapView($0, favoritedColumn: true) }
    }

    // ── 我创建的 ───────────────────────────────────────────────────────────

    func countByOwner(_ sql: any SQLDatabase, _ ownerId: UUID) async throws -> Int {
        guard let row = try await sql.raw(
            "SELECT COUNT(*) AS total FROM capsules WHERE owner_id = \(bind: dbx.uuidValue(ownerId))"
        ).first() else { return 0 }
        return try row.decode(column: "total", as: Int.self)
    }

    func findByOwnerPage(_ sql: any SQLDatabase, _ ownerId: UUID, limit: Int, offset: Int) async throws -> [CapsuleView] {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT \(Self.viewColumns) FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.owner_id = ")
        q.appendInterpolation(bind: dbx.uuidValue(ownerId))
        q.appendLiteral(" ORDER BY c.created_at DESC LIMIT ")
        q.appendInterpolation(bind: limit)
        q.appendLiteral(" OFFSET ")
        q.appendInterpolation(bind: offset)
        return try await sql.raw(q).all().map { try mapView($0) }
    }

    // ── 我收藏的 ───────────────────────────────────────────────────────────

    func countFavoritesByUser(_ sql: any SQLDatabase, _ userId: UUID) async throws -> Int {
        guard let row = try await sql.raw(
            "SELECT COUNT(*) AS total FROM favorites WHERE user_id = \(bind: dbx.uuidValue(userId))"
        ).first() else { return 0 }
        return try row.decode(column: "total", as: Int.self)
    }

    func findFavoritesPage(_ sql: any SQLDatabase, _ userId: UUID, limit: Int, offset: Int) async throws -> [CapsuleView] {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT \(Self.viewColumns), fv.created_at AS favorited_at ")
        q.appendLiteral("FROM favorites fv JOIN capsules c ON c.id = fv.capsule_id JOIN users u ON u.id = c.owner_id ")
        q.appendLiteral("WHERE fv.user_id = ")
        q.appendInterpolation(bind: dbx.uuidValue(userId))
        q.appendLiteral(" ORDER BY fv.created_at DESC LIMIT ")
        q.appendInterpolation(bind: limit)
        q.appendLiteral(" OFFSET ")
        q.appendInterpolation(bind: offset)
        return try await sql.raw(q).all().map { row in
            var view = try mapView(row, favoritedAtColumn: true)
            view.favoritedByMe = true
            return view
        }
    }
}

struct FavoriteRepository {
    let dbx: AppDatabase

    func find(_ sql: any SQLDatabase, userId: UUID, capsuleId: UUID) async throws -> Date? {
        guard let row = try await sql.raw("""
            SELECT created_at FROM favorites
            WHERE user_id = \(bind: dbx.uuidValue(userId)) AND capsule_id = \(bind: dbx.uuidValue(capsuleId))
            """).first() else { return nil }
        return try dbx.date(row, "created_at")
    }

    func exists(_ sql: any SQLDatabase, userId: UUID, capsuleId: UUID) async throws -> Bool {
        try await find(sql, userId: userId, capsuleId: capsuleId) != nil
    }

    /// 幂等插入：已存在时不报错。返回是否真的插入了新行。
    /// PG / SQLite（≥3.24）的 UPSERT + RETURNING 语法一致。
    func insertIgnore(_ sql: any SQLDatabase, userId: UUID, capsuleId: UUID, now: Date) async throws -> Bool {
        try await sql.raw("""
            INSERT INTO favorites (user_id, capsule_id, created_at)
            VALUES (\(bind: dbx.uuidValue(userId)), \(bind: dbx.uuidValue(capsuleId)), \(bind: dbx.dateValue(now)))
            ON CONFLICT (user_id, capsule_id) DO NOTHING
            RETURNING created_at
            """).first() != nil
    }

    /// 幂等删除：返回是否真的删除了行。
    func delete(_ sql: any SQLDatabase, userId: UUID, capsuleId: UUID) async throws -> Bool {
        try await sql.raw("""
            DELETE FROM favorites
            WHERE user_id = \(bind: dbx.uuidValue(userId)) AND capsule_id = \(bind: dbx.uuidValue(capsuleId))
            RETURNING created_at
            """).first() != nil
    }

    func deleteByCapsule(_ sql: any SQLDatabase, _ capsuleId: UUID) async throws {
        try await sql.raw("DELETE FROM favorites WHERE capsule_id = \(bind: dbx.uuidValue(capsuleId))").run()
    }
}

struct RefreshTokenRepository {
    let dbx: AppDatabase

    private func map(_ row: SQLRow) throws -> RefreshTokenRow {
        RefreshTokenRow(
            id: try dbx.uuid(row, "id"),
            userId: try dbx.uuid(row, "user_id"),
            tokenHash: try row.decode(column: "token_hash", as: String.self),
            familyId: try dbx.uuid(row, "family_id"),
            expiresAt: try dbx.date(row, "expires_at"),
            createdAt: try dbx.date(row, "created_at"),
            revokedAt: try dbx.dateOrNil(row, "revoked_at")
        )
    }

    /// Postgres 路径加 FOR UPDATE 行锁，防止并发刷新双花；SQLite 单写连接天然串行。
    func findByTokenHashForUpdate(_ sql: any SQLDatabase, _ tokenHash: String) async throws -> RefreshTokenRow? {
        var q: SQLQueryString = ""
        q.appendLiteral("SELECT * FROM refresh_tokens WHERE token_hash = ")
        q.appendInterpolation(bind: tokenHash)
        if !dbx.isSqlite { q.appendLiteral(" FOR UPDATE") }
        return try await sql.raw(q).first().map { try map($0) }
    }

    func findByTokenHash(_ sql: any SQLDatabase, _ tokenHash: String) async throws -> RefreshTokenRow? {
        try await sql.raw("SELECT * FROM refresh_tokens WHERE token_hash = \(bind: tokenHash)")
            .first().map { try map($0) }
    }

    func insert(_ sql: any SQLDatabase, _ token: RefreshTokenRow) async throws {
        try await sql.raw("""
            INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at, revoked_at)
            VALUES (\(bind: dbx.uuidValue(token.id)), \(bind: dbx.uuidValue(token.userId)),
                    \(bind: token.tokenHash), \(bind: dbx.uuidValue(token.familyId)),
                    \(bind: dbx.dateValue(token.expiresAt)), \(bind: dbx.dateValue(token.createdAt)), NULL)
            """).run()
    }

    func markRevoked(_ sql: any SQLDatabase, id: UUID, now: Date) async throws {
        try await sql.raw("""
            UPDATE refresh_tokens SET revoked_at = \(bind: dbx.dateValue(now))
            WHERE id = \(bind: dbx.uuidValue(id)) AND revoked_at IS NULL
            """).run()
    }

    func revokeFamily(_ sql: any SQLDatabase, familyId: UUID, now: Date) async throws {
        try await sql.raw("""
            UPDATE refresh_tokens SET revoked_at = \(bind: dbx.dateValue(now))
            WHERE family_id = \(bind: dbx.uuidValue(familyId)) AND revoked_at IS NULL
            """).run()
    }

    func revokeUser(_ sql: any SQLDatabase, userId: UUID, now: Date) async throws {
        try await sql.raw("""
            UPDATE refresh_tokens SET revoked_at = \(bind: dbx.dateValue(now))
            WHERE user_id = \(bind: dbx.uuidValue(userId)) AND revoked_at IS NULL
            """).run()
    }
}
