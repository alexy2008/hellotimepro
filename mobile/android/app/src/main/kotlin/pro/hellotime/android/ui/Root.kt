// 根外壳：底部 NavigationBar（广场/开启/创建/我的）+ NavHost + splash + 登录 sheet + 错误横幅。
// 移动 IA 对齐 ui-prototype/mobile.html 与 mobile/ios RootView；受保护 Tab 未登录拦截弹登录。
package pro.hellotime.android.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircleOutline
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.delay
import pro.hellotime.android.AppGraph
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

private data class TabSpec(val route: String, val icon: ImageVector, val label: String, val protected: Boolean)

private val TABS = listOf(
    TabSpec("plaza", Icons.Filled.GridView, "广场", false),
    TabSpec("open", Icons.Filled.LockOpen, "开启", false),
    TabSpec("create", Icons.Filled.AddCircleOutline, "创建", true),
    TabSpec("me", Icons.Outlined.Person, "我的", true),
)

@Composable
fun RootView() {
    val c = HT.colors
    val nav = rememberNavController()
    val session = AppGraph.session
    val showAuth by session.showAuthSheet.collectAsStateWithLifecycle()
    val banner by session.banner.collectAsStateWithLifecycle()
    var showSplash by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { delay(900); showSplash = false }

    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route ?: "plaza"

    Box(Modifier.fillMaxSize().background(c.surface0)) {
        Scaffold(
            containerColor = c.surface0,
            bottomBar = { BottomBar(nav, currentRoute) },
        ) { pad ->
            NavHost(nav, startDestination = "plaza", modifier = Modifier.padding(pad)) {
                composable("plaza") { PlazaScreen(nav) }
                composable("open") { OpenScreen(nav) }
                composable("create") { CreateScreen(nav) }
                composable("me") { MeScreen(nav) }
                composable("me/created") { MeCreatedScreen(nav) }
                composable("me/favorites") { MeFavoritesScreen(nav) }
                composable("me/profile") { MeProfileScreen(nav) }
                composable("about") { AboutScreen(nav) }
                composable("capsule/{code}") { entry ->
                    CapsuleDetailScreen(nav, entry.arguments?.getString("code") ?: "")
                }
            }
        }

        if (showAuth) AuthSheet(nav)

        // 错误横幅（顶部悬浮，可关闭）
        AnimatedVisibility(
            visible = banner != null,
            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(AppSize.s4.dp),
            enter = fadeIn(), exit = fadeOut(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(AppSize.radiusFull.dp))
                    .background(c.surfaceRaised)
                    .padding(horizontal = AppSize.s4.dp, vertical = AppSize.s2.dp),
            ) {
                Icon(Icons.Filled.Warning, null, tint = c.warningFg, modifier = Modifier.width(18.dp))
                Spacer(Modifier.width(AppSize.s2.dp))
                Text(banner ?: "", color = c.textPrimary, fontSize = AppSize.fsSm.sp, modifier = Modifier.weight(1f, fill = false))
                IconButton(onClick = { session.banner.value = null }) {
                    Icon(Icons.Filled.Close, "关闭", tint = c.textMuted, modifier = Modifier.width(16.dp))
                }
            }
        }

        AnimatedVisibility(visible = showSplash, enter = fadeIn(), exit = fadeOut()) { SplashOverlay() }
    }
}

/** Tab 导航 + 受保护路由拦截（= iOS selectTab / go_router redirect）。 */
fun goTab(nav: NavHostController, route: String) {
    val session = AppGraph.session
    val protected = TABS.firstOrNull { it.route == route }?.protected == true
    if (protected && !session.canAccessProtected) {
        session.requireLogin(pending = route)
        return
    }
    nav.navigate(route) {
        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
private fun BottomBar(nav: NavHostController, currentRoute: String) {
    val c = HT.colors
    NavigationBar(containerColor = c.surface1) {
        TABS.forEach { tab ->
            val selected = currentRoute == tab.route ||
                (tab.route == "me" && currentRoute.startsWith("me/"))
            NavigationBarItem(
                selected = selected,
                onClick = { goTab(nav, tab.route) },
                icon = { Icon(tab.icon, tab.label) },
                label = { Text(tab.label, fontSize = AppSize.fsXs.sp) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = c.signalPrimary,
                    selectedTextColor = c.signalPrimary,
                    unselectedIconColor = c.textMuted,
                    unselectedTextColor = c.textMuted,
                    indicatorColor = c.signalSubtle,
                ),
            )
        }
    }
}

/** 启动页（品牌 + 副标）。 */
@Composable
private fun SplashOverlay() {
    val c = HT.colors
    Column(
        modifier = Modifier.fillMaxSize().background(c.surface0),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("⏳", fontSize = 56.sp)
        VSpace(AppSize.s4)
        Row {
            Text("HelloTime ", color = c.textPrimary, fontSize = AppSize.fs3xl.sp, fontWeight = FontWeight.Bold)
            Text("Pro", color = c.brandPrimary, fontSize = AppSize.fs3xl.sp, fontWeight = FontWeight.Bold)
        }
        VSpace(AppSize.s2)
        Text("封存此刻 · 开启未来", color = c.textMuted, fontSize = AppSize.fsSm.sp)
    }
}
