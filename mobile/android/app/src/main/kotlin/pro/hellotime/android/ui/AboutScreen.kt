// 关于页：产品简介 + Android 端技术栈 + 后端技术栈（from /health）。
// = mobile/ios AboutView（技术栈改 Jetpack Compose / Kotlin）。
package pro.hellotime.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.HealthData
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

private const val ANDROID_SUMMARY =
    "本应用是 HelloTime Pro 的原生 Android 端：用 Jetpack Compose 声明式重建整套界面，零 webview。" +
    "与其他移动端（react-native / ios / flutter）实现同一份产品与 /api/v1 契约——" +
    "底部 Tab Bar（广场/开启/创建/我的）+ 登录 sheet 的移动 IA。" +
    "OkHttp 直连宿主反代（模拟器经 10.0.2.2:9080），401 刷新单飞 + 重放对齐各端 api client；" +
    "状态用 Compose state + StateFlow，设计令牌经 gen-tokens-android 从 spec 同源生成。"

@Composable
fun AboutScreen(nav: NavHostController) {
    val c = HT.colors
    var health by remember { mutableStateOf<HealthData?>(null) }
    var err by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try { health = AppGraph.api.health() } catch (e: Exception) {
            err = (e as? ApiException)?.message ?: "连接失败"
        }
    }

    // 顶栏返回箭头 + 内容区（= SubScreen，与我创建的/我收藏的/账号设置同款返回体验）。
    SubScreen(nav, "关于") { pad ->
    Column(
        modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(AppSize.s4.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s5.dp),
    ) {
        Row {
            Text("关于 ", color = c.textPrimary, fontSize = AppSize.fs2xl.sp, fontWeight = FontWeight.Bold)
            Text("HelloTime Pro", color = c.brandPrimary, fontSize = AppSize.fs2xl.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            "一款时光胶囊应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。支持广场浏览、AI 辅助创作、收藏与账户管理。同时是一个多技术栈对比学习项目：同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。",
            color = c.textSecondary, fontSize = AppSize.fsBase.sp, lineHeight = 24.sp,
        )

        StackSection(
            title = "Android 端技术栈",
            items = listOf(
                Triple("Jetpack Compose", "M3", null),
                Triple("Kotlin", "2.4", AppGraph.api.resolveAsset("/static/icons/kotlin.svg")),
            ),
            summary = ANDROID_SUMMARY,
        )

        err?.let { HtAlert(AlertVariant.Danger, "无法读取后端信息：$it") }
        health?.let { h ->
            StackSection(
                title = "后端技术栈",
                items = h.stack.items.map { Triple(it.name, it.version, it.iconUrl?.let { u -> AppGraph.api.resolveAsset(u) }) },
                summary = h.stack.summary,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s5.dp)) {
            MetaItem("Android 端", "Compose / Kotlin")
            MetaItem("后端", health?.stack?.items?.firstOrNull { it.role == "framework" }?.name ?: "—")
            MetaItem("License", "MIT")
        }
        VSpace(AppSize.s8)
    }
    }
}

@Composable
private fun StackSection(title: String, items: List<Triple<String, String, String?>>, summary: String) {
    val c = HT.colors
    Column(verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp)) {
        Text(title, color = c.textPrimary, fontSize = AppSize.fsXl.sp, fontWeight = FontWeight.SemiBold)
        SectionCard {
            Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s5.dp)) {
                items.forEach { (name, version, icon) ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        if (icon != null) SvgIcon(icon, 40.dp) else Text("🤖", fontSize = 32.sp)
                        Text(
                            "$name${if (version.isEmpty()) "" else " $version"}",
                            color = c.textMuted, fontSize = AppSize.fsXs.sp, fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
            Text(summary, color = c.textSecondary, fontSize = AppSize.fsSm.sp, lineHeight = 22.sp)
        }
    }
}

@Composable
private fun MetaItem(label: String, value: String) {
    val c = HT.colors
    Row {
        Text("$label：", color = c.textMuted, fontSize = AppSize.fsSm.sp)
        Text(value, color = c.textSecondary, fontSize = AppSize.fsSm.sp, fontFamily = FontFamily.Monospace)
    }
}
