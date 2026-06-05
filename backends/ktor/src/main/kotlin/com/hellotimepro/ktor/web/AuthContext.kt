package com.hellotimepro.ktor.web

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.service.SecurityService
import com.hellotimepro.ktor.service.parseUuidOrNull

/** 从 Authorization 头解析 Bearer JWT 并加载当前用户。对应 Spring 的 AuthContext。 */
class AuthContext(
    private val security: SecurityService,
    private val users: UserRepository,
) {
    /** 匿名可访问端点：无/非法 token 返回 null。 */
    suspend fun optional(authorization: String?): User? {
        val token = parseBearer(authorization) ?: return null
        val subject = security.decodeAccessToken(token).subject ?: return null
        val id = parseUuidOrNull(subject) ?: return null
        return dbQuery { users.findById(id) }
    }

    /** 受保护端点：缺失/过期/非法 → UNAUTHORIZED。 */
    suspend fun required(authorization: String?): User {
        val token = parseBearer(authorization) ?: throw ApiException.unauthorized("缺少 access token")
        val decoded = security.decodeAccessToken(token)
        val subject = decoded.subject ?: throw ApiException.unauthorized(decoded.error ?: "invalid_token")
        val id = parseUuidOrNull(subject) ?: throw ApiException.unauthorized("invalid_token")
        return dbQuery { users.findById(id) } ?: throw ApiException.unauthorized("用户不存在")
    }

    private fun parseBearer(authorization: String?): String? {
        if (authorization.isNullOrBlank()) return null
        val parts = authorization.trim().split(Regex("\\s+"), limit = 2)
        if (parts.size != 2 || !parts[0].equals("bearer", ignoreCase = true)) return null
        return parts[1].trim()
    }
}
