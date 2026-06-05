package com.hellotimepro.ktor

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.service.SecurityService
import com.hellotimepro.ktor.service.Validation
import com.hellotimepro.ktor.web.ApiException
import com.hellotimepro.ktor.web.ErrorCode
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** 纯单元冒烟：不依赖数据库或网络，覆盖鉴权基础件与字段校验。 */
class SmokeTest {
    private val security = SecurityService(AppConfig(jwtSecret = "test-secret"))

    @Test
    fun `bcrypt round trip`() {
        val hash = security.hashPassword("password1234")
        assertTrue(security.verifyPassword("password1234", hash))
        assertFalse(security.verifyPassword("wrongpassword1", hash))
    }

    @Test
    fun `jwt subject round trip`() {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val user = User(UUID.randomUUID(), "a@b.com", "x", "nick", "neo", now, now)
        val token = security.createAccessToken(user)
        assertEquals(3, token.split(".").size)
        assertEquals(user.id.toString(), security.decodeAccessToken(token).subject)
    }

    @Test
    fun `refresh token hash is deterministic`() {
        val raw = security.generateRefreshToken()
        assertTrue(raw.length >= 32)
        assertEquals(security.hashRefreshToken(raw), security.hashRefreshToken(raw))
    }

    @Test
    fun `validation rejects bad input with VALIDATION_ERROR`() {
        assertEquals("a@b.com", Validation.email("  A@B.com  ".lowercase()).lowercase())
        assertFailsWith<ApiException> { Validation.email("not-email") }.also {
            assertEquals(ErrorCode.VALIDATION_ERROR, it.code)
        }
        assertFailsWith<ApiException> { Validation.password("short") }
        assertFailsWith<ApiException> { Validation.nickname("!") }
        assertFailsWith<ApiException> { Validation.title("x".repeat(61)) }
        assertFailsWith<ApiException> { Validation.openAt("not-a-date") }
    }
}
