import Foundation
import SQLKit

/// 注册 / 登录 / 刷新 / 登出 / 改密。
struct AuthService: Sendable {
    let config: AppConfig
    let db: AppDatabase
    let users: UserRepository
    let refreshTokens: RefreshTokenRepository
    let security: SecurityService
    let mapper: MapperService
    let avatars: AvatarService
    let rateLimiter: LoginRateLimiter

    func register(_ req: RegisterRequest) async throws -> JSON {
        let email = try Validation.email(req.email).lowercased()
        let rawPassword = try Validation.password(req.password)
        let nickname = try Validation.nickname(req.nickname)
        let avatarId = try Validation.avatarFormat(req.avatarId)
        guard avatars.exists(avatarId) else {
            throw ApiError.validation("头像 ID 不存在", "avatarId")
        }
        let passwordHash = try security.hashPassword(rawPassword)

        return try await db.transaction { sql in
            if try await users.existsByEmail(sql, email) {
                throw ApiError.conflict("邮箱已被注册", "email")
            }
            if try await users.existsByNickname(sql, nickname) {
                throw ApiError.conflict("昵称已被使用", "nickname")
            }
            let now = Date()
            let user = User(
                id: UUID(), email: email, passwordHash: passwordHash,
                nickname: nickname, avatarId: avatarId, createdAt: now, updatedAt: now
            )
            try await users.insert(sql, user)
            return try await issueTokenPair(sql, user: user, familyId: nil)
        }
    }

    func login(_ req: LoginRequest) async throws -> JSON {
        let email = try Validation.email(req.email).lowercased()
        let password = try Validation.requireNonBlank(req.password, "password")
        if await rateLimiter.isLimited(email) {
            throw ApiError.rateLimited("操作过于频繁，请稍后再试")
        }
        let outcome: JSON? = try await db.transaction { sql in
            guard let user = try await users.findByEmail(sql, email),
                  security.verifyPassword(password, hashed: user.passwordHash) else {
                return nil
            }
            return try await issueTokenPair(sql, user: user, familyId: nil)
        }
        guard let tokens = outcome else {
            await rateLimiter.recordFailure(email)
            throw ApiError.unauthorized("邮箱或密码错误")
        }
        return tokens
    }

    func refresh(_ rawRefresh: String?) async throws -> JSON {
        let raw = try Validation.requireNonBlank(rawRefresh, "refreshToken")
        let tokenHash = security.hashRefreshToken(raw)
        // 关键：重用检测分支必须提交 family 吊销后再抛 401，
        // 所以事务内不抛异常，用 outcome 区分，throw 放到事务外。
        let outcome: RefreshOutcome = try await db.transaction { sql in
            guard let row = try await refreshTokens.findByTokenHashForUpdate(sql, tokenHash) else {
                return .invalid
            }
            let now = Date()
            guard row.expiresAt > now else { return .invalid }
            if row.revokedAt != nil {
                try await refreshTokens.revokeFamily(sql, familyId: row.familyId, now: now)
                return .reused
            }
            guard let user = try await users.findById(sql, row.userId) else { return .invalid }
            try await refreshTokens.markRevoked(sql, id: row.id, now: now)
            return .success(try await issueTokenPair(sql, user: user, familyId: row.familyId))
        }
        switch outcome {
        case .success(let tokens): return tokens
        case .invalid: throw ApiError.unauthorized("refresh token 无效")
        case .reused: throw ApiError.unauthorized("refresh token 已失效")
        }
    }

    func logout(_ rawRefresh: String?) async throws {
        guard let raw = rawRefresh, !raw.isEmpty else { return }
        let hash = security.hashRefreshToken(raw)
        try await db.transaction { sql in
            if let row = try await refreshTokens.findByTokenHash(sql, hash), row.revokedAt == nil {
                try await refreshTokens.markRevoked(sql, id: row.id, now: Date())
            }
        }
    }

    func changePassword(_ user: User, _ req: ChangePasswordRequest) async throws {
        let current = try Validation.requireNonBlank(req.currentPassword, "currentPassword")
        let newPassword = try Validation.password(req.newPassword, "newPassword")
        guard security.verifyPassword(current, hashed: user.passwordHash) else {
            throw ApiError.unauthorized("当前密码错误")
        }
        let newHash = try security.hashPassword(newPassword)
        try await db.transaction { sql in
            let now = Date()
            try await users.updatePassword(sql, id: user.id, passwordHash: newHash, now: now)
            // 改密后吊销该用户所有 refresh token（含当前会话）。
            try await refreshTokens.revokeUser(sql, userId: user.id, now: now)
        }
    }

    /// 在当前事务内签发 access + refresh 对，并落库 refresh token 行。
    private func issueTokenPair(_ sql: any SQLDatabase, user: User, familyId: UUID?) async throws -> JSON {
        let access = security.createAccessToken(user: user)
        let refresh = security.generateRefreshToken()
        let now = Date()
        try await refreshTokens.insert(sql, RefreshTokenRow(
            id: UUID(),
            userId: user.id,
            tokenHash: security.hashRefreshToken(refresh),
            familyId: familyId ?? UUID(),
            expiresAt: now.addingTimeInterval(TimeInterval(config.refreshTokenTtlSeconds)),
            createdAt: now,
            revokedAt: nil
        ))
        return .object([
            "accessToken": .string(access),
            "refreshToken": .string(refresh),
            "accessTokenExpiresIn": .int(config.accessTokenTtlSeconds),
            "refreshTokenExpiresIn": .int(config.refreshTokenTtlSeconds),
            "user": mapper.user(user),
        ])
    }

    private enum RefreshOutcome: Sendable {
        case success(JSON)
        case invalid
        case reused
    }
}

/// 每邮箱失败次数滑动窗口（教学项目：进程内存实现，多 worker 下失效，见 docs/dev-notes.md §1）。
actor LoginRateLimiter {
    private let limit: Int
    private let windowSeconds: TimeInterval = 60
    private var failures: [String: [Date]] = [:]

    init(limit: Int) {
        self.limit = limit
    }

    func isLimited(_ email: String) -> Bool {
        let cutoff = Date().addingTimeInterval(-windowSeconds)
        let bucket = (failures[email] ?? []).filter { $0 > cutoff }
        failures[email] = bucket
        return bucket.count >= limit
    }

    func recordFailure(_ email: String) {
        failures[email, default: []].append(Date())
    }
}
