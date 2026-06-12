import Vapor

/// 从 Authorization 头解析 Bearer JWT 并加载当前用户。对应 Ktor 的 AuthContext。
struct AuthContext: Sendable {
    let security: SecurityService
    let db: AppDatabase
    let users: UserRepository

    /// 匿名可访问端点：无/非法 token 返回 nil。
    func optional(_ req: Request) async throws -> User? {
        guard let token = parseBearer(req.headers.first(name: .authorization)) else { return nil }
        guard let subject = security.decodeAccessToken(token).subject,
              let id = AppDatabase.parseUuid(subject) else { return nil }
        return try await db.withSQL { sql in try await users.findById(sql, id) }
    }

    /// 受保护端点：缺失/过期/非法 → UNAUTHORIZED。
    func required(_ req: Request) async throws -> User {
        guard let token = parseBearer(req.headers.first(name: .authorization)) else {
            throw ApiError.unauthorized("缺少 access token")
        }
        let decoded = security.decodeAccessToken(token)
        guard let subject = decoded.subject else {
            throw ApiError.unauthorized(decoded.error ?? "invalid_token")
        }
        guard let id = AppDatabase.parseUuid(subject) else {
            throw ApiError.unauthorized("invalid_token")
        }
        guard let user = try await db.withSQL({ sql in try await users.findById(sql, id) }) else {
            throw ApiError.unauthorized("用户不存在")
        }
        return user
    }

    private func parseBearer(_ authorization: String?) -> String? {
        guard let raw = authorization?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        let parts = raw.split(separator: " ", maxSplits: 1)
        guard parts.count == 2, parts[0].lowercased() == "bearer" else { return nil }
        return parts[1].trimmingCharacters(in: .whitespaces)
    }
}
