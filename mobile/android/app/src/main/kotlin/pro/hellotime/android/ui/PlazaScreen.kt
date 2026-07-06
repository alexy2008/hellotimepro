// 广场：紧凑 hero（渐变标题 + 双 CTA）+ 工具栏（排序/筛选/防抖搜索）+ 单列卡片 + 分页。
// 匿名可浏览；顶栏带主题切换 + 关于（登录前可达，= mobile/ios 最新修正）。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import kotlinx.coroutines.delay
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.CapsuleListItem
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlazaScreen(nav: NavHostController) {
    val c = HT.colors
    val theme = AppGraph.theme
    val dark by theme.dark.collectAsStateWithLifecycle()

    var items by remember { mutableStateOf<List<CapsuleListItem>>(emptyList()) }
    var sort by remember { mutableStateOf("new") }
    var filter by remember { mutableStateOf("all") }
    var query by remember { mutableStateOf("") }
    var page by remember { mutableIntStateOf(1) }
    var totalPages by remember { mutableIntStateOf(1) }
    var total by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }

    // 拉取：sort/filter/page 变化即刷；query 300ms 防抖
    suspend fun reload() {
        loading = true
        try {
            val r = AppGraph.api.plaza(sort = sort, filter = filter, q = query, page = page)
            items = r.items
            totalPages = maxOf(r.pagination.totalPages, 1)
            total = r.pagination.total
        } catch (e: Exception) {
            AppGraph.session.report(e)
        } finally {
            loading = false
        }
    }
    LaunchedEffect(sort, filter, page) { reload() }
    var queryHydrated by remember { mutableStateOf(false) }
    LaunchedEffect(query) {
        if (!queryHydrated) { queryHydrated = true; return@LaunchedEffect } // 首帧由上面的 effect 拉
        delay(300)
        page = 1
        reload()
    }

    Scaffold(
        containerColor = c.surface0,
        topBar = {
            TopAppBar(
                // 品牌头：logo + HelloTime + PRO 徽章（= flutter MobileShell / iOS PlazaView）。
                // logo.svg 打进 assets，Coil+SvgDecoder 从 android_asset 渲染。
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        SvgIcon("file:///android_asset/logo.svg", 26.dp)
                        Spacer(Modifier.width(AppSize.s2.dp))
                        Text("HelloTime", color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "PRO",
                            fontSize = AppSize.fsXs.sp,
                            fontWeight = FontWeight.Bold,
                            style = androidx.compose.ui.text.TextStyle(
                                brush = Brush.linearGradient(listOf(c.signalPrimary, c.brandPrimary, c.accentPrimary)),
                            ),
                            modifier = Modifier
                                .clip(RoundedCornerShape(AppSize.radiusFull.dp))
                                .background(c.brandSubtle.copy(alpha = 0.5f))
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = c.surface0),
                // 状态栏 inset 已由 Root.kt 外层 Scaffold 统一处理（NavHost padding），
                // 这里不再重复占用，否则叠加出一块空白（= 本次修的 bug）。
                windowInsets = WindowInsets(0, 0, 0, 0),
                actions = {
                    IconButton(onClick = { theme.toggle() }) {
                        Icon(
                            if (dark) Icons.Filled.DarkMode else Icons.Filled.LightMode,
                            contentDescription = "切换主题", tint = c.textSecondary,
                        )
                    }
                    IconButton(onClick = { nav.navigate("about") }) {
                        Icon(Icons.Outlined.Info, contentDescription = "关于", tint = c.textSecondary)
                    }
                },
            )
        },
    ) { pad ->
        Column(
            modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = AppSize.s4.dp),
            verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
        ) {
            Hero(nav)

            // 工具栏：排序 / 筛选 / 搜索 三行竖排（= RN / iOS / flutter 窄屏）
            Segmented(listOf("new" to "✨ 最新", "hot" to "🔥 热门"), sort) { sort = it; page = 1 }
            Segmented(listOf("all" to "全部", "opened" to "已开启", "unopened" to "未开启"), filter) { filter = it; page = 1 }
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text("搜索标题或昵称…", fontSize = AppSize.fsSm.sp) },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = c.textMuted) },
                colors = htFieldColors(),
                shape = RoundedCornerShape(AppSize.radiusMd.dp),
            )

            if (loading && items.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(vertical = AppSize.s16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = c.signalPrimary)
                }
            } else if (items.isEmpty()) {
                EmptyState(
                    "🌌", "广场暂无胶囊 —— 来当第一个写信给未来的人？",
                    cta = if (AppGraph.session.isAuthenticated) "创建胶囊" else "注册并创建",
                ) { goTab(nav, "create") }
            } else {
                items.forEach { item ->
                    CapsuleCard(item) { nav.navigate("capsule/${item.code}") }
                }
            }

            PaginationBar(page, totalPages, total) { page = it }
            VSpace(AppSize.s8)
        }
    }
}

/** 紧凑 hero：渐变标题 + 紫光背景 + 双 CTA（等宽防折行）。 */
@Composable
private fun Hero(nav: NavHostController) {
    val c = HT.colors
    Box(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(AppSize.radiusXl.dp))
            .background(c.gradientBrandSubtle),
    ) {
        // 居中紫色辉光（blur 补偿，Material 阴影只有高度模型）
        Box(
            Modifier.align(Alignment.Center).size(220.dp, 120.dp)
                .blur(60.dp).clip(CircleShape).background(c.plazaGlow),
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = AppSize.s5.dp, vertical = AppSize.s6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp),
        ) {
            Row {
                Text(
                    "封存此刻 ",
                    color = c.textPrimary, fontSize = AppSize.fs3xl.sp, fontWeight = FontWeight.Bold,
                )
                Text(
                    "开启未来",
                    fontSize = AppSize.fs3xl.sp, fontWeight = FontWeight.Bold,
                    style = androidx.compose.ui.text.TextStyle(
                        brush = Brush.linearGradient(listOf(c.signalPrimary, c.brandPrimary, c.accentPrimary)),
                    ),
                )
            }
            Text(
                "写下此刻最真实的想法，设定一个解封时刻——时间到了，它才会被打开。",
                color = c.textSecondary, fontSize = AppSize.fsSm.sp, textAlign = TextAlign.Center,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s3.dp)) {
                HtButton(
                    "创建胶囊", modifier = Modifier.weight(1f),
                    variant = BtnVariant.HeroPrimary, icon = Icons.Filled.AutoAwesome,
                ) { goTab(nav, "create") }
                HtButton(
                    "用码开启", modifier = Modifier.weight(1f),
                    variant = BtnVariant.HeroSuccess, icon = Icons.Filled.LockOpen,
                ) { goTab(nav, "open") }
            }
        }
    }
}
