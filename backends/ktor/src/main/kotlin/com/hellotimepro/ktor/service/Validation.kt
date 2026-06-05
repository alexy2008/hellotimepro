package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.web.ApiException
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

/**
 * 手写字段校验（Ktor 无 Bean Validation）。失败统一抛 VALIDATION_ERROR → 422，
 * 与 spec/openapi.yaml 的正则/长度约束一致。
 */
object Validation {
    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private val PASSWORD = Regex("^(?=.*[A-Za-z])(?=.*\\d).{8,128}$")
    private val NICKNAME = Regex("^[\\p{L}\\p{N}_-]{2,20}$")
    private val AVATAR = Regex("^[a-z0-9-]{2,20}$")
    private val CODE = Regex("^[A-Za-z0-9]{8}$")

    fun email(value: String?): String {
        val e = value?.trim().orEmpty()
        if (e.isEmpty() || e.length > 254 || !EMAIL.matches(e)) {
            throw ApiException.validation("邮箱格式不正确", "email")
        }
        return e
    }

    fun requireNonBlank(value: String?, field: String): String {
        if (value.isNullOrBlank()) throw ApiException.validation("$field 不能为空", field)
        return value
    }

    fun password(value: String?, field: String = "password"): String {
        if (value == null || !PASSWORD.matches(value)) {
            throw ApiException.validation("密码至少 8 位且需包含字母和数字", field)
        }
        return value
    }

    fun nickname(value: String?): String {
        if (value == null || !NICKNAME.matches(value)) {
            throw ApiException.validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname")
        }
        return value
    }

    fun avatarFormat(value: String?): String {
        if (value == null || !AVATAR.matches(value)) {
            throw ApiException.validation("头像 ID 格式不正确", "avatarId")
        }
        return value
    }

    fun title(value: String?): String {
        if (value == null || value.isEmpty() || value.length > 60) {
            throw ApiException.validation("标题长度需为 1-60", "title")
        }
        return value
    }

    fun content(value: String?): String {
        if (value == null || value.isEmpty() || value.length > 5000) {
            throw ApiException.validation("内容长度需为 1-5000", "content")
        }
        return value
    }

    fun openAt(value: String?): OffsetDateTime {
        if (value.isNullOrBlank()) throw ApiException.validation("openAt 不能为空", "openAt")
        return try {
            OffsetDateTime.parse(value)
        } catch (_: DateTimeParseException) {
            throw ApiException.validation("openAt 必须是 ISO-8601 时间", "openAt")
        }
    }

    fun code(value: String): String {
        if (!CODE.matches(value)) throw ApiException.validation("code 必须为 8 位字母数字", "code")
        return value
    }

    fun page(page: Int, pageSize: Int) {
        if (page < 1) throw ApiException.validation("page 必须 >= 1", "page")
        if (pageSize < 1 || pageSize > 50) throw ApiException.validation("pageSize 范围 1-50", "pageSize")
    }
}
