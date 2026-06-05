package com.hellotimepro.ktor.dto

import kotlinx.serialization.Serializable

// ── 统一响应外壳 ───────────────────────────────────────────────────────────

/** 成功响应外壳：`{ success, data, message, errorCode }`。 */
@Serializable
data class Envelope<T>(
    val success: Boolean,
    val data: T?,
    val message: String? = null,
    val errorCode: String? = null,
) {
    companion object {
        fun <T> ok(data: T): Envelope<T> = Envelope(true, data, null, null)
    }
}

@Serializable
data class ErrorDetail(val field: String, val message: String)

/** 失败响应外壳。data 恒为 null；details 仅 VALIDATION_ERROR / 带字段的 CONFLICT 时为数组。 */
@Serializable
data class ErrorEnvelope(
    val success: Boolean = false,
    val data: String? = null,
    val message: String,
    val errorCode: String,
    val details: List<ErrorDetail>? = null,
)

@Serializable
data class Pagination(val page: Int, val pageSize: Int, val total: Long, val totalPages: Int)

@Serializable
data class Paginated<T>(val items: List<T>, val pagination: Pagination)

// ── 用户 / 头像 ────────────────────────────────────────────────────────────

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val nickname: String,
    val avatarId: String,
    val createdAt: String,
)

@Serializable
data class UserBrief(val nickname: String, val avatarId: String)

@Serializable
data class AvatarDto(
    val id: String,
    val name: String,
    val primaryColor: String,
    val svgUrl: String? = null,
)

// ── 鉴权 ───────────────────────────────────────────────────────────────────

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresIn: Long,
    val refreshTokenExpiresIn: Long,
    val user: UserDto,
)

@Serializable
data class RegisterRequest(
    val email: String? = null,
    val password: String? = null,
    val nickname: String? = null,
    val avatarId: String? = null,
)

@Serializable
data class LoginRequest(val email: String? = null, val password: String? = null)

@Serializable
data class RefreshRequest(val refreshToken: String? = null)

@Serializable
data class LogoutRequest(val refreshToken: String? = null)

@Serializable
data class UpdateProfileRequest(val nickname: String? = null, val avatarId: String? = null)

@Serializable
data class ChangePasswordRequest(val currentPassword: String? = null, val newPassword: String? = null)

// ── 胶囊 ───────────────────────────────────────────────────────────────────

@Serializable
data class CreateCapsuleRequest(
    val title: String? = null,
    val content: String? = null,
    val openAt: String? = null,
    val inPlaza: Boolean? = null,
)

@Serializable
data class FavoriteRequest(val capsuleId: String? = null)

/** 单个胶囊详情：含 content（未开启为 null）。 */
@Serializable
data class CapsuleDetail(
    val id: String,
    val code: String,
    val title: String,
    val creator: UserBrief,
    val openAt: String,
    val createdAt: String,
    val inPlaza: Boolean,
    val favoriteCount: Int,
    val isOpened: Boolean,
    val content: String?,
    val favoritedByMe: Boolean,
)

/** 列表项：不含 content，含 contentPreview / favoritedAt。 */
@Serializable
data class CapsuleListItem(
    val id: String,
    val code: String,
    val title: String,
    val creator: UserBrief,
    val openAt: String,
    val createdAt: String,
    val inPlaza: Boolean,
    val favoriteCount: Int,
    val isOpened: Boolean,
    val favoritedByMe: Boolean,
    val favoritedAt: String? = null,
    val contentPreview: String? = null,
)

@Serializable
data class FavoriteResult(val capsuleId: String, val favoriteCount: Int, val favoritedAt: String)

// ── 健康检查 ───────────────────────────────────────────────────────────────

@Serializable
data class StackItem(val role: String, val name: String, val version: String, val iconUrl: String? = null)

@Serializable
data class StackInfo(val kind: String, val summary: String, val items: List<StackItem>)

@Serializable
data class HealthData(
    val status: String,
    val service: String,
    val version: String,
    val uptimeSeconds: Long,
    val stack: StackInfo,
)

// ── AI 建议 / 推荐 ─────────────────────────────────────────────────────────

@Serializable
data class CapsuleSuggestionRequest(val title: String? = null, val locale: String? = null)

@Serializable
data class CapsuleSuggestion(
    // 仅空标题模式下返回非 null，供前端回填。
    val title: String?,
    val content: String,
    val openInDays: Int,
    val openAt: String,
    val generatedBy: String,
    val cached: Boolean,
)

@Serializable
data class CapsuleRecommendationItem(val title: String, val hint: String, val openInDays: Int)

@Serializable
data class CapsuleRecommendationList(
    val items: List<CapsuleRecommendationItem>,
    val generatedBy: String,
    val cached: Boolean,
)
