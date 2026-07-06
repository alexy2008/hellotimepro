// Application 入口：手工装配依赖图（教学项目不上 Hilt，让接线可见）。
// ApiClient 与 SessionStore 经回调互指 —— 对齐 react-ts 的 configureApi 注册回调模式。
package pro.hellotime.android

import android.app.Application
import android.content.Context
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import pro.hellotime.android.data.ApiClient
import pro.hellotime.android.data.SessionStore
import pro.hellotime.android.data.ThemeStore

private val Context.dataStore by preferencesDataStore(name = "hellotime")

object AppGraph {
    lateinit var api: ApiClient
    lateinit var session: SessionStore
    lateinit var theme: ThemeStore
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    fun init(ctx: Context) {
        val ds = ctx.dataStore
        session = SessionStore(ds, scope)
        api = ApiClient(
            baseUrl = BuildConfig.API_BASE,
            getAccessToken = { session.accessToken },
            getRefreshToken = { session.refreshTokenValue() },
            onTokensRefreshed = { a, r -> session.patchTokens(a, r) },
            onAuthLost = { session.clearSession() },
        )
        session.api = api
        theme = ThemeStore(ds, scope)
        scope.launch {
            theme.hydrate()
            session.bootstrap()
        }
    }
}

class HelloTimeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.init(this)
        // Coil 全局 ImageLoader 注册 SVG 解码器（后端头像/图标全是 SVG）。
        coil3.SingletonImageLoader.setSafe { ctx ->
            coil3.ImageLoader.Builder(ctx)
                .components { add(coil3.svg.SvgDecoder.Factory()) }
                .build()
        }
    }
}
