// 会话 store：鉴权状态 + DataStore 持久化（refreshToken + user）+ 启动恢复。
// = desktop/swiftui AppStore 的会话部分 / react-ts auth store。
// access token 只存内存；refresh token 旋转由 ApiClient 回调 patchTokens 落盘。
package pro.hellotime.android.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

private val KEY_REFRESH = stringPreferencesKey("auth.refreshToken")
private val KEY_USER = stringPreferencesKey("auth.user")

class SessionStore(
    private val prefs: DataStore<Preferences>,
    private val scope: CoroutineScope,
) {
    lateinit var api: ApiClient // AppGraph 注入（回调互指，避免构造环）

    @Volatile
    var accessToken: String? = null
        private set
    private val refreshToken = MutableStateFlow<String?>(null)
    val currentUser = MutableStateFlow<User?>(null)
    val hydrated = MutableStateFlow(false)
    /** 全局错误横幅（= iOS AppStore.banner）。 */
    val banner = MutableStateFlow<String?>(null)

    /** 登录 sheet（= iOS AppStore.showAuthSheet）；pendingRoute 登录成功后回跳。 */
    val showAuthSheet = MutableStateFlow(false)
    var pendingRoute: String? = null

    fun requireLogin(pending: String? = null) {
        pendingRoute = pending
        showAuthSheet.value = true
    }

    private val json = Json { ignoreUnknownKeys = true }

    val isAuthenticated: Boolean get() = accessToken != null && currentUser.value != null
    /** 守卫放行：有 user，或仅有 refreshToken（启动未拉到 access），接口会自动 refresh。 */
    val canAccessProtected: Boolean get() = currentUser.value != null || refreshToken.value != null
    fun refreshTokenValue(): String? = refreshToken.value

    // ---------- 启动 ----------
    suspend fun bootstrap() {
        val p = prefs.data.first()
        refreshToken.value = p[KEY_REFRESH]
        p[KEY_USER]?.let { raw ->
            runCatching { json.decodeFromString<User>(raw) }.onSuccess { currentUser.value = it }
        }
        hydrated.value = true
        if (refreshToken.value != null) runCatching { refreshMe() }
    }

    suspend fun refreshMe() {
        currentUser.value = api.me() // 401 由 ApiClient 走 onAuthLost
        persist()
    }

    // ---------- 鉴权动作 ----------
    suspend fun login(email: String, password: String) {
        apply(api.login(LoginRequest(email, password)))
    }

    suspend fun register(email: String, password: String, nickname: String, avatarId: String) {
        apply(api.register(RegisterRequest(email, password, nickname, avatarId)))
    }

    suspend fun logout() {
        val rt = refreshToken.value
        clearSession()
        if (rt != null) runCatching { api.logout(rt) }
    }

    fun setCurrentUser(u: User) {
        currentUser.value = u
        scope.launch { persist() }
    }

    // ---------- 内部 ----------
    private fun apply(tokens: AuthTokens) {
        accessToken = tokens.accessToken
        refreshToken.value = tokens.refreshToken
        currentUser.value = tokens.user
        scope.launch { persist() }
    }

    /** ApiClient 回调：refresh 旋转后落盘新 refresh token。 */
    fun patchTokens(access: String, refresh: String) {
        accessToken = access
        refreshToken.value = refresh
        scope.launch { persist() }
    }

    /** ApiClient 回调：refresh 失败 / 会话失效。 */
    fun clearSession() {
        accessToken = null
        refreshToken.value = null
        currentUser.value = null
        scope.launch { prefs.edit { it.remove(KEY_REFRESH); it.remove(KEY_USER) } }
    }

    private suspend fun persist() {
        val rt = refreshToken.value ?: return
        val u = currentUser.value ?: return
        prefs.edit {
            it[KEY_REFRESH] = rt
            it[KEY_USER] = json.encodeToString(User.serializer(), u)
        }
    }

    fun report(e: Throwable) {
        if (e is ApiException && e.isUnauthorized) {
            clearSession()
            banner.value = "登录已过期，请重新登录"
        } else {
            banner.value = e.message ?: "发生未知错误"
        }
    }
}
