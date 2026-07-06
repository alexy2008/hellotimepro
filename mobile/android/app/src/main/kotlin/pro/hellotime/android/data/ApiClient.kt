// ============================================================
// API 客户端：统一拼 URL、解 Envelope、自动 refresh。
// 与 frontends/react-ts src/api/client.ts 1:1 对齐（refresh 单飞 +
// 401 重放一次 + Envelope 解包 + 端点封装）；OkHttp = Android 的 URLSession。
//
// - access token 存内存（SessionStore）；refresh token 存 store + DataStore
// - access 缺失 / 过期（401 UNAUTHORIZED）→ 单飞 refresh + 重放一次
// - 单飞用 Mutex + 「进锁后先看 access 是否已被别人换新」——refresh token
//   是旋转式的（旧的换出即吊销），不能让并发请求各自拿旧 token 去刷。
// ============================================================
package pro.hellotime.android.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Serializable
private data class RefreshedTokens(val accessToken: String, val refreshToken: String)

class ApiClient(
    val baseUrl: String,
    private val getAccessToken: () -> String?,
    private val getRefreshToken: () -> String?,
    private val onTokensRefreshed: (access: String, refresh: String) -> Unit,
    private val onAuthLost: () -> Unit,
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)   // AI 生成接口可能较慢
        .build()
    private val refreshMutex = Mutex()

    fun resolveAsset(path: String): String =
        if (path.startsWith("http")) path else "$baseUrl$path"

    // ---------- refresh 单飞 ----------
    /** prevAccess = 触发本次刷新的请求所用的 access（可能为 null）。 */
    private suspend fun tryRefresh(prevAccess: String?): String? = refreshMutex.withLock {
        // 排队进锁后：若 access 已被并发的刷新换新，直接复用，不再旋转 refresh token。
        val current = getAccessToken()
        if (current != null && current != prevAccess) return current
        val rt = getRefreshToken() ?: return null
        try {
            val body = json.encodeToString(RefreshRequest(rt))
            val res = withContext(Dispatchers.IO) {
                http.newCall(
                    Request.Builder().url("$baseUrl/api/v1/auth/refresh")
                        .post(body.toRequestBody(jsonMedia)).build()
                ).execute()
            }
            val text = res.body?.string() ?: ""
            val env = json.decodeFromString<Envelope<RefreshedTokens>>(text)
            if (!res.isSuccessful || !env.success || env.data == null) {
                onAuthLost(); null
            } else {
                onTokensRefreshed(env.data.accessToken, env.data.refreshToken)
                env.data.accessToken
            }
        } catch (_: Exception) {
            onAuthLost(); null
        }
    }

    // ---------- 通用请求 ----------
    suspend inline fun <reified T> request(
        path: String,
        method: String = "GET",
        body: String? = null,
        auth: Boolean = true,
    ): T = requestInternal(path, method, body, auth, retry = false) { text ->
        json.decodeFromString<Envelope<T>>(text)
    }.let { it as T }

    @PublishedApi
    internal suspend fun <T> requestInternal(
        path: String,
        method: String,
        body: String?,
        auth: Boolean,
        retry: Boolean,
        decode: (String) -> Envelope<T>,
    ): Any? {
        val usedAccess = if (auth) (getAccessToken() ?: tryRefresh(null)) else null

        val builder = Request.Builder().url("$baseUrl$path").header("Accept", "application/json")
        if (usedAccess != null) builder.header("Authorization", "Bearer $usedAccess")
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> if (body != null) builder.delete(body.toRequestBody(jsonMedia)) else builder.delete()
            else -> builder.method(method, (body ?: "{}").toRequestBody(jsonMedia))
        }

        val res = withContext(Dispatchers.IO) { http.newCall(builder.build()).execute() }
        if (res.code == 204) return Unit

        val text = withContext(Dispatchers.IO) { res.body?.string() ?: "" }
        val env = try {
            decode(text)
        } catch (_: Exception) {
            throw ApiException("响应解析失败", res.code, "INTERNAL_ERROR")
        }

        if (!res.isSuccessful || !env.success) {
            // 401 → 自动 refresh + 重放一次（覆盖 access 过期 / 缺失 / 无效）。
            if (res.code == 401 && env.errorCode == "UNAUTHORIZED" && auth && !retry && getRefreshToken() != null) {
                val newAt = tryRefresh(usedAccess)
                if (newAt != null) return requestInternal(path, method, body, auth, retry = true, decode)
            }
            throw ApiException(env.message ?: "请求失败", res.code, env.errorCode, env.details)
        }
        return env.data
    }

    // ---------- 端点封装（= react-ts api.*） ----------
    suspend fun health(): HealthData = request("/api/v1/health", auth = false)

    suspend fun suggestCapsule(req: CapsuleSuggestionRequest): CapsuleSuggestion =
        request("/api/v1/capsule-suggestion", "POST", json.encodeToString(req), auth = false)

    suspend fun capsuleRecommendations(count: Int? = null, locale: String? = null): CapsuleRecommendationList {
        val qs = buildList {
            count?.let { add("count=$it") }
            locale?.let { add("locale=$it") }
        }.joinToString("&")
        return request("/api/v1/capsule-recommendations${if (qs.isEmpty()) "" else "?$qs"}", auth = false)
    }

    suspend fun avatars(): List<Avatar> = request("/api/v1/avatars", auth = false)

    // ---- 鉴权
    suspend fun register(req: RegisterRequest): AuthTokens =
        request("/api/v1/auth/register", "POST", json.encodeToString(req), auth = false)

    suspend fun login(req: LoginRequest): AuthTokens =
        request("/api/v1/auth/login", "POST", json.encodeToString(req), auth = false)

    suspend fun logout(refreshToken: String?) {
        request<Unit>(
            "/api/v1/auth/logout", "POST",
            if (refreshToken != null) json.encodeToString(LogoutRequest(refreshToken)) else "{}",
            auth = false,
        )
    }

    // ---- 当前用户
    suspend fun me(): User = request("/api/v1/me")
    suspend fun updateProfile(req: UpdateProfileRequest): User =
        request("/api/v1/me", "PATCH", json.encodeToString(req))
    suspend fun changePassword(req: ChangePasswordRequest) {
        request<Unit>("/api/v1/me/password", "POST", json.encodeToString(req))
    }

    // ---- 胶囊
    suspend fun createCapsule(req: CreateCapsuleRequest): CapsuleDetail =
        request("/api/v1/capsules", "POST", json.encodeToString(req))

    suspend fun capsuleByCode(code: String): CapsuleDetail =
        request("/api/v1/capsules/${java.net.URLEncoder.encode(code, "UTF-8")}")

    // ---- 广场
    suspend fun plaza(
        sort: String = "new", filter: String = "all", q: String = "",
        page: Int = 1, pageSize: Int = 15,
    ): PaginatedCapsules {
        val params = buildList {
            add("sort=$sort"); add("filter=$filter")
            if (q.isNotBlank()) add("q=${java.net.URLEncoder.encode(q, "UTF-8")}")
            add("page=$page"); add("pageSize=$pageSize")
        }.joinToString("&")
        return request("/api/v1/plaza/capsules?$params")
    }

    // ---- 我创建的
    suspend fun myCapsules(page: Int = 1, pageSize: Int = 20): PaginatedCapsules =
        request("/api/v1/me/capsules?page=$page&pageSize=$pageSize")

    suspend fun deleteMyCapsule(id: String) {
        request<Unit>("/api/v1/me/capsules/${java.net.URLEncoder.encode(id, "UTF-8")}", "DELETE")
    }

    // ---- 收藏
    suspend fun myFavorites(page: Int = 1, pageSize: Int = 20): PaginatedCapsules =
        request("/api/v1/me/favorites?page=$page&pageSize=$pageSize")

    suspend fun favorite(capsuleId: String): FavoriteResult =
        request("/api/v1/me/favorites", "POST", """{"capsuleId":${json.encodeToString(capsuleId)}}""")

    suspend fun unfavorite(capsuleId: String) {
        request<Unit>("/api/v1/me/favorites/${java.net.URLEncoder.encode(capsuleId, "UTF-8")}", "DELETE")
    }
}

@Serializable
data class FavoriteResult(val capsuleId: String, val favoriteCount: Int, val favoritedAt: String)
