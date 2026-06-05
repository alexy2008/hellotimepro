package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.RefreshToken
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.AuthTokens
import com.hellotimepro.ktor.dto.ChangePasswordRequest
import com.hellotimepro.ktor.dto.LoginRequest
import com.hellotimepro.ktor.dto.RegisterRequest
import com.hellotimepro.ktor.repository.RefreshTokenRepository
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.web.ApiException
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class AuthService(
    private val config: AppConfig,
    private val users: UserRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val security: SecurityService,
    private val mapper: MapperService,
    private val avatars: AvatarService,
) {
    // 每邮箱失败次数滑动窗口（教学项目，多 worker 下失效，见 docs/dev-notes.md §1）。
    private val failures = ConcurrentHashMap<String, ArrayDeque<Long>>()

    suspend fun register(req: RegisterRequest): AuthTokens {
        val email = Validation.email(req.email).lowercase()
        val rawPassword = Validation.password(req.password)
        val nickname = Validation.nickname(req.nickname)
        val avatarId = Validation.avatarFormat(req.avatarId)
        if (!avatars.exists(avatarId)) throw ApiException.validation("头像 ID 不存在", "avatarId")

        return dbQuery {
            if (users.existsByEmail(email)) throw ApiException.conflict("邮箱已被注册", "email")
            if (users.existsByNickname(nickname)) throw ApiException.conflict("昵称已被使用", "nickname")
            val now = nowUtc()
            val user = User(
                id = UUID.randomUUID(),
                email = email,
                passwordHash = security.hashPassword(rawPassword),
                nickname = nickname,
                avatarId = avatarId,
                createdAt = now,
                updatedAt = now,
            )
            users.insert(user)
            issueTokenPair(user, null)
        }
    }

    suspend fun login(req: LoginRequest): AuthTokens {
        val email = Validation.email(req.email).lowercase()
        val password = Validation.requireNonBlank(req.password, "password")
        rateLimit(email)
        return dbQuery {
            val user = users.findByEmail(email)
            if (user == null || !security.verifyPassword(password, user.passwordHash)) {
                recordFailure(email)
                throw ApiException.unauthorized("邮箱或密码错误")
            }
            issueTokenPair(user, null)
        }
    }

    suspend fun refresh(rawRefresh: String?): AuthTokens {
        val raw = Validation.requireNonBlank(rawRefresh, "refreshToken")
        val tokenHash = security.hashRefreshToken(raw)
        // 关键：重用检测分支必须提交 family 吊销后再抛 401，所以事务内不抛异常，
        // 用 outcome 区分，throw 放到事务外（对应 Spring 的 noRollbackFor=ApiException）。
        val outcome = dbQuery {
            val row = refreshTokens.findByTokenHashForUpdate(tokenHash)
                ?: return@dbQuery RefreshOutcome.Invalid
            val now = nowUtc()
            if (!row.expiresAt.isAfter(now)) return@dbQuery RefreshOutcome.Invalid
            if (row.revokedAt != null) {
                refreshTokens.revokeFamily(row.familyId, now)
                return@dbQuery RefreshOutcome.Reused
            }
            val user = users.findById(row.userId) ?: return@dbQuery RefreshOutcome.Invalid
            refreshTokens.markRevoked(row.id, now)
            RefreshOutcome.Success(issueTokenPair(user, row.familyId))
        }
        return when (outcome) {
            is RefreshOutcome.Success -> outcome.tokens
            RefreshOutcome.Invalid -> throw ApiException.unauthorized("refresh token 无效")
            RefreshOutcome.Reused -> throw ApiException.unauthorized("refresh token 已失效")
        }
    }

    suspend fun logout(rawRefresh: String?) {
        if (rawRefresh.isNullOrBlank()) return
        val hash = security.hashRefreshToken(rawRefresh)
        dbQuery {
            val row = refreshTokens.findByTokenHash(hash)
            if (row != null && row.revokedAt == null) {
                refreshTokens.markRevoked(row.id, nowUtc())
            }
        }
    }

    suspend fun changePassword(user: User, req: ChangePasswordRequest) {
        Validation.requireNonBlank(req.currentPassword, "currentPassword")
        val newPassword = Validation.password(req.newPassword, "newPassword")
        if (!security.verifyPassword(req.currentPassword!!, user.passwordHash)) {
            throw ApiException.unauthorized("当前密码错误")
        }
        dbQuery {
            users.update(user.copy(passwordHash = security.hashPassword(newPassword), updatedAt = nowUtc()))
            refreshTokens.revokeUser(user.id, nowUtc())
        }
    }

    /** 在当前事务内签发 access + refresh 对，并落库 refresh token 行。 */
    private fun issueTokenPair(user: User, familyId: UUID?): AuthTokens {
        val access = security.createAccessToken(user)
        val refresh = security.generateRefreshToken()
        val now = nowUtc()
        refreshTokens.insert(
            RefreshToken(
                id = UUID.randomUUID(),
                userId = user.id,
                tokenHash = security.hashRefreshToken(refresh),
                familyId = familyId ?: UUID.randomUUID(),
                expiresAt = now.plusSeconds(config.refreshTokenTtlSeconds),
                createdAt = now,
                revokedAt = null,
            ),
        )
        return AuthTokens(
            accessToken = access,
            refreshToken = refresh,
            accessTokenExpiresIn = config.accessTokenTtlSeconds,
            refreshTokenExpiresIn = config.refreshTokenTtlSeconds,
            user = mapper.user(user),
        )
    }

    private fun rateLimit(email: String) {
        val bucket = failures.computeIfAbsent(email) { ArrayDeque() }
        val now = System.nanoTime()
        synchronized(bucket) {
            while (bucket.isNotEmpty() && (now - bucket.peekFirst()) > 60_000_000_000L) bucket.removeFirst()
            if (bucket.size >= config.loginRateLimitPerMinute) {
                throw ApiException.rateLimited("操作过于频繁，请稍后再试")
            }
        }
    }

    private fun recordFailure(email: String) {
        val bucket = failures.computeIfAbsent(email) { ArrayDeque() }
        synchronized(bucket) { bucket.addLast(System.nanoTime()) }
    }

    private sealed interface RefreshOutcome {
        data class Success(val tokens: AuthTokens) : RefreshOutcome
        data object Invalid : RefreshOutcome
        data object Reused : RefreshOutcome
    }
}
