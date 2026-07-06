// 数据模型：与 spec/api/openapi.yaml 对齐（kotlinx.serialization）。
// 字段面逐字对照 frontends/react-ts src/types/index.ts（= mobile/react-native types）。
package pro.hellotime.android.data

import kotlinx.serialization.Serializable

@Serializable
data class FieldError(val field: String, val message: String)

@Serializable
data class Envelope<T>(
    val success: Boolean,
    val data: T? = null,
    val message: String? = null,
    val errorCode: String? = null,
    val details: List<FieldError>? = null,
)

@Serializable
data class Pagination(val page: Int, val pageSize: Int, val total: Int, val totalPages: Int)

@Serializable
data class Avatar(val id: String, val name: String, val primaryColor: String, val svgUrl: String? = null)

@Serializable
data class User(
    val id: String,
    val email: String,
    val nickname: String,
    val avatarId: String,
    val createdAt: String,
)

@Serializable
data class UserBrief(val nickname: String, val avatarId: String)

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
    val favoritedByMe: Boolean = false,
    val favoritedAt: String? = null,
    val contentPreview: String? = null,
)

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
    val content: String? = null,
    val favoritedByMe: Boolean = false,
)

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresIn: Long,
    val refreshTokenExpiresIn: Long? = null,
    val user: User,
)

@Serializable
data class StackItem(val role: String, val name: String, val version: String, val iconUrl: String? = null)

@Serializable
data class StackInfo(val kind: String, val summary: String, val items: List<StackItem>)

@Serializable
data class HealthData(
    val status: String,
    val service: String,
    val version: String,
    val uptimeSeconds: Double,
    val stack: StackInfo,
)

@Serializable
data class CapsuleSuggestionRequest(val title: String? = null, val locale: String? = null)

@Serializable
data class CapsuleSuggestion(
    val title: String? = null,
    val content: String,
    val openInDays: Int,
    val openAt: String,
    val generatedBy: String,
    val cached: Boolean,
)

@Serializable
data class CapsuleRecommendation(val title: String, val hint: String, val openInDays: Int)

@Serializable
data class CapsuleRecommendationList(
    val items: List<CapsuleRecommendation>,
    val generatedBy: String,
    val cached: Boolean,
)

@Serializable
data class PaginatedCapsules(val items: List<CapsuleListItem>, val pagination: Pagination)

@Serializable
data class CreateCapsuleRequest(
    val title: String,
    val content: String,
    val openAt: String,
    val inPlaza: Boolean = true,
)

@Serializable
data class RegisterRequest(val email: String, val password: String, val nickname: String, val avatarId: String)

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class LogoutRequest(val refreshToken: String)

@Serializable
data class UpdateProfileRequest(val nickname: String? = null, val avatarId: String? = null)

@Serializable
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)

/** 响应外壳失败 → 异常（对齐 react-ts 的 ApiError）。 */
class ApiException(
    message: String,
    val status: Int,
    val errorCode: String? = null,
    val details: List<FieldError>? = null,
) : Exception(message) {
    val isUnauthorized: Boolean get() = status == 401 || errorCode == "UNAUTHORIZED"
}
