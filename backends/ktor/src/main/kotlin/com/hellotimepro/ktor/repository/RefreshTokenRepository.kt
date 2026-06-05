package com.hellotimepro.ktor.repository

import com.hellotimepro.ktor.db.RefreshTokens
import com.hellotimepro.ktor.db.isSqliteDialect
import com.hellotimepro.ktor.domain.RefreshToken
import org.jetbrains.exposed.sql.*
import java.time.OffsetDateTime
import java.util.UUID

class RefreshTokenRepository {
    fun findByTokenHash(hash: String): RefreshToken? =
        RefreshTokens.select { RefreshTokens.tokenHash eq hash }.firstOrNull()?.toRefreshToken()

    /** Postgres 用行锁保证同一个 refresh token 只能被一个请求完成轮转。 */
    fun findByTokenHashForUpdate(hash: String): RefreshToken? {
        val q = RefreshTokens.select { RefreshTokens.tokenHash eq hash }
        if (!isSqliteDialect) q.forUpdate()
        return q.firstOrNull()?.toRefreshToken()
    }

    fun insert(token: RefreshToken) {
        RefreshTokens.insert {
            it[id] = token.id
            it[userId] = token.userId
            it[tokenHash] = token.tokenHash
            it[familyId] = token.familyId
            it[expiresAt] = token.expiresAt
            it[createdAt] = token.createdAt
            // revokedAt 不写：DB 默认 NULL，避免对自定义列绑定 null。
        }
    }

    fun markRevoked(id: UUID, now: OffsetDateTime) {
        RefreshTokens.update({ RefreshTokens.id eq id }) { it[revokedAt] = now }
    }

    fun revokeFamily(familyId: UUID, now: OffsetDateTime) {
        RefreshTokens.update({ (RefreshTokens.familyId eq familyId) and RefreshTokens.revokedAt.isNull() }) {
            it[revokedAt] = now
        }
    }

    fun revokeUser(userId: UUID, now: OffsetDateTime) {
        RefreshTokens.update({ (RefreshTokens.userId eq userId) and RefreshTokens.revokedAt.isNull() }) {
            it[revokedAt] = now
        }
    }
}
