package com.hellotimepro.ktor.web

import com.hellotimepro.ktor.dto.ErrorDetail
import io.ktor.http.HttpStatusCode

enum class ErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    CONFLICT,
    RATE_LIMITED,
    BAD_REQUEST,
    INTERNAL_ERROR,
}

/** 业务异常：由 StatusPages 统一转换为契约约定的 ErrorEnvelope + HTTP 状态码。 */
class ApiException(
    val code: ErrorCode,
    override val message: String,
    val status: HttpStatusCode,
    val details: List<ErrorDetail>? = null,
) : RuntimeException(message) {
    companion object {
        fun validation(message: String, field: String) = ApiException(
            ErrorCode.VALIDATION_ERROR, message, HttpStatusCode.UnprocessableEntity,
            listOf(ErrorDetail(field, message)),
        )

        fun unauthorized(message: String) =
            ApiException(ErrorCode.UNAUTHORIZED, message, HttpStatusCode.Unauthorized)

        fun forbidden(message: String) =
            ApiException(ErrorCode.FORBIDDEN, message, HttpStatusCode.Forbidden)

        fun notFound(message: String) =
            ApiException(ErrorCode.NOT_FOUND, message, HttpStatusCode.NotFound)

        fun conflict(message: String, field: String?) = ApiException(
            ErrorCode.CONFLICT, message, HttpStatusCode.Conflict,
            field?.let { listOf(ErrorDetail(it, message)) },
        )

        fun badRequest(message: String) =
            ApiException(ErrorCode.BAD_REQUEST, message, HttpStatusCode.BadRequest)

        fun rateLimited(message: String) =
            ApiException(ErrorCode.RATE_LIMITED, message, HttpStatusCode.TooManyRequests)
    }
}
