// 「我的」Tab：个人头 + 链接列表（我创建的/我收藏的/账号设置/关于）+ 登出；
// 子屏压栈（me/created、me/favorites、me/profile）。= mobile/ios MeView。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.Avatar
import pro.hellotime.android.data.CapsuleListItem
import pro.hellotime.android.data.ChangePasswordRequest
import pro.hellotime.android.data.UpdateProfileRequest
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

@Composable
fun MeScreen(nav: NavHostController) {
    val c = HT.colors
    val session = AppGraph.session
    val scope = rememberCoroutineScope()
    val user by session.currentUser.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(AppSize.s4.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp),
    ) {
        // 个人头
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(AppSize.radiusLg.dp))
                .background(c.surface1).padding(AppSize.s4.dp),
        ) {
            AvatarView(user?.avatarId, user?.nickname ?: "?", 56.dp)
            Spacer(Modifier.width(AppSize.s3.dp))
            Column {
                Text(user?.nickname ?: "…", color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.SemiBold)
                Text(user?.email ?: "", color = c.textMuted, fontSize = AppSize.fsSm.sp)
            }
        }

        LinkRow(Icons.Filled.EditNote, "我创建的") { nav.navigate("me/created") }
        LinkRow(Icons.Filled.FavoriteBorder, "我收藏的") { nav.navigate("me/favorites") }
        LinkRow(Icons.Filled.Settings, "账号设置") { nav.navigate("me/profile") }
        LinkRow(Icons.Filled.Info, "关于") { nav.navigate("about") }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(AppSize.radiusLg.dp))
                .background(c.surface1)
                .clickable { scope.launch { session.logout(); goTab(nav, "plaza") } }
                .padding(AppSize.s4.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.Logout, null, tint = c.dangerFg, modifier = Modifier.width(22.dp))
            Spacer(Modifier.width(AppSize.s3.dp))
            Text("登出", color = c.dangerFg, fontSize = AppSize.fsBase.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun LinkRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    val c = HT.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(AppSize.radiusLg.dp))
            .background(c.surface1).clickable { onClick() }.padding(AppSize.s4.dp),
    ) {
        Icon(icon, null, tint = c.signalPrimary, modifier = Modifier.width(22.dp))
        Spacer(Modifier.width(AppSize.s3.dp))
        Text(label, color = c.textPrimary, fontSize = AppSize.fsBase.sp)
        Spacer(Modifier.weight(1f))
        Icon(Icons.Filled.ChevronRight, null, tint = c.textMuted, modifier = Modifier.width(18.dp))
    }
}

/** 子屏骨架：返回栏 + 内容。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubScreen(nav: NavHostController, title: String, content: @Composable (androidx.compose.foundation.layout.PaddingValues) -> Unit) {
    val c = HT.colors
    Scaffold(
        containerColor = c.surface0,
        topBar = {
            TopAppBar(
                title = { Text(title, color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.SemiBold) },
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
        content = content,
    )
}

// ---------- 我创建的 ----------

@Composable
fun MeCreatedScreen(nav: NavHostController) {
    val c = HT.colors
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<CapsuleListItem>>(emptyList()) }
    var page by remember { mutableIntStateOf(1) }
    var totalPages by remember { mutableIntStateOf(1) }
    var total by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<CapsuleListItem?>(null) }

    suspend fun reload() {
        loading = true
        try {
            val r = AppGraph.api.myCapsules(page = page)
            items = r.items; totalPages = maxOf(r.pagination.totalPages, 1); total = r.pagination.total
        } catch (e: Exception) { AppGraph.session.report(e) } finally { loading = false }
    }
    LaunchedEffect(page) { reload() }

    SubScreen(nav, "我创建的") { pad ->
        Column(
            modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = AppSize.s4.dp),
            verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("共 $total 条", color = c.textMuted, fontSize = AppSize.fsSm.sp)
                Spacer(Modifier.weight(1f))
                HtButton("+ 新建", size = BtnSize.Sm) { goTab(nav, "create") }
            }
            if (loading && items.isEmpty()) {
                androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().padding(vertical = AppSize.s16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = c.signalPrimary)
                }
            } else if (items.isEmpty()) {
                EmptyState("📭", "还没有创建任何胶囊", cta = "去创建一个") { goTab(nav, "create") }
            } else {
                items.forEach { item ->
                    CapsuleCard(
                        item, showCreator = false,
                        rightSlot = {
                            if (item.isOpened) {
                                Text("♥ ${item.favoriteCount}", color = c.favoriteActive, fontSize = AppSize.fsSm.sp)
                            } else {
                                HtButton("撤回", variant = BtnVariant.Danger, size = BtnSize.Sm) { pendingDelete = item }
                            }
                        },
                    ) { nav.navigate("capsule/${item.code}") }
                }
            }
            PaginationBar(page, totalPages, total) { page = it }
            VSpace(AppSize.s8)
        }
    }

    pendingDelete?.let { target ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { pendingDelete = null },
            containerColor = c.surface1,
            title = { Text("确认撤回？", color = c.textPrimary) },
            text = { Text("此操作不可恢复。", color = c.textSecondary) },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = {
                    pendingDelete = null
                    scope.launch {
                        try { AppGraph.api.deleteMyCapsule(target.id); reload() } catch (e: Exception) { AppGraph.session.report(e) }
                    }
                }) { Text("撤回", color = c.dangerFg) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { pendingDelete = null }) { Text("取消", color = c.textSecondary) }
            },
        )
    }
}

// ---------- 我收藏的 ----------

@Composable
fun MeFavoritesScreen(nav: NavHostController) {
    val c = HT.colors
    var items by remember { mutableStateOf<List<CapsuleListItem>>(emptyList()) }
    var page by remember { mutableIntStateOf(1) }
    var totalPages by remember { mutableIntStateOf(1) }
    var total by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(page) {
        loading = true
        try {
            val r = AppGraph.api.myFavorites(page = page)
            items = r.items; totalPages = maxOf(r.pagination.totalPages, 1); total = r.pagination.total
        } catch (e: Exception) { AppGraph.session.report(e) } finally { loading = false }
    }

    SubScreen(nav, "我收藏的") { pad ->
        Column(
            modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = AppSize.s4.dp),
            verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
        ) {
            Text("共 $total 条；取消收藏只会从此列表移除，不影响原胶囊。", color = c.textMuted, fontSize = AppSize.fsSm.sp)
            if (loading && items.isEmpty()) {
                androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().padding(vertical = AppSize.s16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = c.signalPrimary)
                }
            } else if (items.isEmpty()) {
                EmptyState("🗂", "还没有收藏任何胶囊 —— 去广场看看？", cta = "去广场") { goTab(nav, "plaza") }
            } else {
                items.forEach { item -> CapsuleCard(item) { nav.navigate("capsule/${item.code}") } }
            }
            PaginationBar(page, totalPages, total) { page = it }
            VSpace(AppSize.s8)
        }
    }
}

// ---------- 账号设置 ----------

@Composable
fun MeProfileScreen(nav: NavHostController) {
    val c = HT.colors
    val session = AppGraph.session
    val scope = rememberCoroutineScope()
    val user by session.currentUser.collectAsStateWithLifecycle()

    var avatars by remember { mutableStateOf<List<Avatar>>(emptyList()) }
    var nickname by remember { mutableStateOf(user?.nickname ?: "") }
    var avatarId by remember { mutableStateOf(user?.avatarId) }
    var profileBusy by remember { mutableStateOf(false) }
    var profileMsg by remember { mutableStateOf<Pair<AlertVariant, String>?>(null) }

    var oldPwd by remember { mutableStateOf("") }
    var newPwd by remember { mutableStateOf("") }
    var confirmPwd by remember { mutableStateOf("") }
    var pwdBusy by remember { mutableStateOf(false) }
    var pwdMsg by remember { mutableStateOf<Pair<AlertVariant, String>?>(null) }

    LaunchedEffect(Unit) {
        runCatching { AppGraph.api.avatars() }.onSuccess { avatars = it }
    }

    SubScreen(nav, "账号设置") { pad ->
    Column(
        modifier = Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(AppSize.s4.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s5.dp),
    ) {
        SectionCard {
            Text("基本信息", color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.SemiBold)
            FieldLabel("邮箱")
            Text(user?.email ?: "", color = c.textMuted, fontSize = AppSize.fsBase.sp)
            FieldLabel("昵称")
            OutlinedTextField(
                value = nickname, onValueChange = { nickname = it },
                modifier = Modifier.fillMaxWidth(), singleLine = true, colors = htFieldColors(),
            )
            FieldLabel("头像")
            AvatarPicker(avatars = avatars, selected = avatarId, onSelect = { avatarId = it })
            profileMsg?.let { HtAlert(it.first, it.second) }
            Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp), modifier = Modifier.fillMaxWidth()) {
                Spacer(Modifier.weight(1f))
                HtButton("重置", variant = BtnVariant.Ghost) {
                    nickname = user?.nickname ?: ""; avatarId = user?.avatarId
                }
                HtButton(if (profileBusy) "保存中…" else "保存", enabled = !profileBusy) {
                    val u = user ?: return@HtButton
                    profileMsg = null
                    val newNick = nickname.trim().takeIf { it != u.nickname }
                    val newAvatar = avatarId.takeIf { it != null && it != u.avatarId }
                    if (newNick == null && newAvatar == null) {
                        profileMsg = AlertVariant.Info to "没有改动"
                        return@HtButton
                    }
                    profileBusy = true
                    scope.launch {
                        try {
                            val updated = AppGraph.api.updateProfile(UpdateProfileRequest(nickname = newNick, avatarId = newAvatar))
                            session.setCurrentUser(updated)
                            profileMsg = AlertVariant.Success to "已保存"
                        } catch (e: Exception) {
                            profileMsg = AlertVariant.Danger to ((e as? ApiException)?.message ?: "保存失败")
                        } finally { profileBusy = false }
                    }
                }
            }
        }

        SectionCard {
            Text("修改密码", color = c.textPrimary, fontSize = AppSize.fsLg.sp, fontWeight = FontWeight.SemiBold)
            FieldLabel("当前密码")
            OutlinedTextField(
                value = oldPwd, onValueChange = { oldPwd = it }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), colors = htFieldColors(),
            )
            FieldLabel("新密码", hint = "至少 8 位且含字母和数字；保存后所有登录会失效")
            OutlinedTextField(
                value = newPwd, onValueChange = { newPwd = it }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), colors = htFieldColors(),
            )
            FieldLabel("确认新密码")
            OutlinedTextField(
                value = confirmPwd, onValueChange = { confirmPwd = it }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), colors = htFieldColors(),
            )
            pwdMsg?.let { HtAlert(it.first, it.second) }
            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(Modifier.weight(1f))
                HtButton(
                    if (pwdBusy) "更新中…" else "更新密码",
                    enabled = !pwdBusy && oldPwd.isNotEmpty() && newPwd.length >= 8,
                ) {
                    pwdMsg = null
                    if (newPwd != confirmPwd) {
                        pwdMsg = AlertVariant.Danger to "两次输入的新密码不一致"
                        return@HtButton
                    }
                    pwdBusy = true
                    scope.launch {
                        try {
                            AppGraph.api.changePassword(ChangePasswordRequest(oldPwd, newPwd))
                            pwdMsg = AlertVariant.Success to "密码已更新，3 秒后将自动登出。"
                            oldPwd = ""; newPwd = ""; confirmPwd = ""
                            delay(3000)
                            session.logout()
                        } catch (e: Exception) {
                            pwdMsg = AlertVariant.Danger to ((e as? ApiException)?.message ?: "修改失败")
                        } finally { pwdBusy = false }
                    }
                }
            }
        }
        VSpace(AppSize.s8)
    }
    }
}
