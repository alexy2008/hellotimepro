// 胶囊详情：密封 → 倒计时（每秒跳动）；已开启 → 正文。码复制 / 收藏 / 作者可删除。
// = mobile/ios CapsuleDetailView / React CapsulePage。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.CapsuleDetail
import pro.hellotime.android.data.CapsuleListItem
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT
import pro.hellotime.android.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CapsuleDetailScreen(nav: NavHostController, code: String) {
    val c = HT.colors
    val scope = rememberCoroutineScope()
    var cap by remember { mutableStateOf<CapsuleDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current

    suspend fun reload() {
        try {
            cap = AppGraph.api.capsuleByCode(code)
            error = null
        } catch (e: Exception) {
            error = (e as? ApiException)?.message ?: "加载失败"
        }
    }
    LaunchedEffect(code) { reload() }

    // 密封 → 每秒 tick；到点自动重拉（解封）
    var now by remember { mutableStateOf(java.time.Instant.now()) }
    LaunchedEffect(cap?.id, cap?.isOpened) {
        val current = cap ?: return@LaunchedEffect
        if (current.isOpened) return@LaunchedEffect
        while (true) {
            delay(1000)
            now = java.time.Instant.now()
            if (DateUtil.countdown(current.openAt, now) == null) { reload(); break }
        }
    }

    Scaffold(
        containerColor = c.surface0,
        topBar = {
            TopAppBar(
                title = { Text("胶囊详情", color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = c.surface0),
                // 状态栏 inset 已由 Root.kt 外层 Scaffold 统一处理，这里不重复占用。
                windowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = c.textSecondary)
                    }
                },
            )
        },
    ) { pad ->
        when {
            error != null -> Column(Modifier.padding(pad).padding(AppSize.s4.dp)) {
                HtAlert(AlertVariant.Danger, error!!)
                VSpace(AppSize.s4)
                HtButton("返回", variant = BtnVariant.Ghost) { nav.popBackStack() }
            }
            cap == null -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = c.signalPrimary)
            }
            else -> {
                val cur = cap!!
                Column(
                    modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(horizontal = AppSize.s4.dp),
                    verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StatusBadge(cur.isOpened)
                        Spacer(Modifier.weight(1f))
                        Text(cur.code, color = c.signalPrimary, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = AppSize.fsSm.sp)
                        IconButton(onClick = {
                            clipboard.setText(AnnotatedString(cur.code))
                        }) { Icon(Icons.Filled.ContentCopy, "复制胶囊码", tint = c.textMuted, modifier = Modifier.width(16.dp)) }
                    }

                    Text(cur.title, color = c.textPrimary, fontSize = AppSize.fs2xl.sp, fontWeight = FontWeight.Bold)

                    if (cur.isOpened) {
                        SectionCard {
                            Text(
                                cur.content ?: "",
                                color = c.textSecondary, fontSize = AppSize.fsBase.sp, lineHeight = 26.sp,
                            )
                        }
                    } else {
                        SealedCountdown(cur.openAt, now)
                    }

                    // 元信息 + 收藏
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AvatarView(cur.creator.avatarId, cur.creator.nickname, 28.dp)
                        Spacer(Modifier.width(AppSize.s2.dp))
                        Column {
                            Text(cur.creator.nickname, color = c.textSecondary, fontSize = AppSize.fsSm.sp)
                            Text(
                                "${if (cur.isOpened) "开启于" else "将开启于"} ${DateUtil.display(cur.openAt)}",
                                color = c.textMuted, fontSize = AppSize.fsXs.sp,
                            )
                        }
                        Spacer(Modifier.weight(1f))
                        FavoriteButton(cur.asListItem())
                    }

                    // 作者可删除（不可改内容/时间 —— 契约规定不可变）
                    val me by AppGraph.session.currentUser.collectAsStateWithLifecycle()
                    if (me != null && me?.nickname == cur.creator.nickname) {
                        HtButton(
                            "🗑 删除这枚我创建的胶囊",
                            modifier = Modifier.fillMaxWidth(),
                            variant = BtnVariant.Danger, size = BtnSize.Sm,
                        ) { confirmDelete = true }
                    }
                    VSpace(AppSize.s8)
                }

                if (confirmDelete) {
                    AlertDialog(
                        onDismissRequest = { confirmDelete = false },
                        containerColor = c.surface1,
                        title = { Text("确认删除？", color = c.textPrimary) },
                        text = { Text("删除后不可恢复。", color = c.textSecondary) },
                        confirmButton = {
                            TextButton(onClick = {
                                confirmDelete = false
                                scope.launch {
                                    try {
                                        AppGraph.api.deleteMyCapsule(cur.id)
                                        nav.popBackStack()
                                    } catch (e: Exception) { AppGraph.session.report(e) }
                                }
                            }) { Text("删除", color = c.dangerFg) }
                        },
                        dismissButton = {
                            TextButton(onClick = { confirmDelete = false }) { Text("取消", color = c.textSecondary) }
                        },
                    )
                }
            }
        }
    }
}

/** 密封倒计时盘（= mobile.html sealed-countdown-dial：辉光圆盘 + 天/时/分/秒）。 */
@Composable
private fun SealedCountdown(openAt: String, now: java.time.Instant) {
    val c = HT.colors
    val parts = DateUtil.countdown(openAt, now)
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = AppSize.s5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp)) {
            (parts ?: listOf(0L to "天", 0L to "时", 0L to "分", 0L to "秒")).forEach { (v, unit) ->
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(AppSize.radiusMd.dp))
                        .background(c.surface2)
                        .border(1.dp, c.capsuleSealedBorder, RoundedCornerShape(AppSize.radiusMd.dp))
                        .padding(horizontal = AppSize.s3.dp, vertical = AppSize.s2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        v.toString().padStart(2, '0'),
                        color = c.capsuleSealedAccent, fontSize = AppSize.fs2xl.sp,
                        fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                    )
                    Text(unit, color = c.textMuted, fontSize = AppSize.fsXs.sp)
                }
            }
        }
        Text("时间未到，内容仍被封存", color = c.textMuted, fontSize = AppSize.fsSm.sp)
    }
}

private fun CapsuleDetail.asListItem() = CapsuleListItem(
    id = id, code = code, title = title, creator = creator, openAt = openAt,
    createdAt = createdAt, inPlaza = inPlaza, favoriteCount = favoriteCount,
    isOpened = isOpened, favoritedByMe = favoritedByMe,
)
