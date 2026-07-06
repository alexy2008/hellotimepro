// HelloTime Pro · Android 原生（Jetpack Compose）入口。
// 纯 API 消费者：OkHttp 直连宿主反代（模拟器经 10.0.2.2:9080），复用既有 /api/v1 契约。
package pro.hellotime.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import pro.hellotime.android.theme.HelloTimeTheme
import pro.hellotime.android.ui.RootView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val dark by AppGraph.theme.dark.collectAsStateWithLifecycle()
            HelloTimeTheme(dark = dark) {
                RootView()
            }
        }
    }
}
