package com.hellotimepro.ktor.service

import at.favre.lib.crypto.bcrypt.BCrypt
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.exceptions.TokenExpiredException
import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.domain.User
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64
import java.util.Date

/** 密码哈希（bcrypt）与 JWT（HS256）+ refresh token 生成/哈希。对应 Spring 的 SecurityService。 */
class SecurityService(private val config: AppConfig) {
    private val algorithm: Algorithm = Algorithm.HMAC256(config.jwtSecret)
    private val verifier = JWT.require(algorithm).build()
    private val secureRandom = SecureRandom()

    fun hashPassword(plain: String): String =
        BCrypt.withDefaults().hashToString(10, plain.toCharArray())

    fun verifyPassword(plain: String, hashed: String): Boolean =
        BCrypt.verifyer().verify(plain.toCharArray(), hashed.toCharArray()).verified

    fun createAccessToken(user: User): String {
        val now = Instant.now()
        return JWT.create()
            .withSubject(user.id.toString())
            .withClaim("nickname", user.nickname)
            .withClaim("avatarId", user.avatarId)
            .withIssuedAt(Date.from(now))
            .withExpiresAt(Date.from(now.plusSeconds(config.accessTokenTtlSeconds)))
            .sign(algorithm)
    }

    /** 校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。 */
    fun decodeAccessToken(token: String): DecodeResult = try {
        DecodeResult(verifier.verify(token).subject, null)
    } catch (_: TokenExpiredException) {
        DecodeResult(null, "access_token_expired")
    } catch (_: JWTVerificationException) {
        DecodeResult(null, "invalid_token")
    }

    fun generateRefreshToken(): String {
        val raw = ByteArray(32)
        secureRandom.nextBytes(raw)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw)
    }

    fun hashRefreshToken(raw: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    data class DecodeResult(val subject: String?, val error: String?)
}
