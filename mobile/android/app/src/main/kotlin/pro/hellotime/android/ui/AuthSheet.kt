// 登录 / 注册合体 sheet（ModalBottomSheet + 分段切换）。
// = mobile/ios AuthSheet：登录成功回跳 pendingRoute；注册含头像九宫格。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import kotlinx.coroutines.launch
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.Avatar
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthSheet(nav: NavHostController) {
    val c = HT.colors
    val session = AppGraph.session
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var mode by remember { mutableStateOf("login") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var avatars by remember { mutableStateOf<List<Avatar>>(emptyList()) }
    var avatarId by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        runCatching { AppGraph.api.avatars() }.onSuccess {
            avatars = it
            if (avatarId == null) avatarId = it.firstOrNull()?.id
        }
    }

    fun submit() {
        error = null
        busy = true
        scope.launch {
            try {
                if (mode == "login") session.login(email.trim(), password)
                else session.register(email.trim(), password, nickname.trim(), avatarId ?: "")
                // 成功：关 sheet + 回跳（登录默认去我的，注册默认去创建 —— 对齐 iOS）
                session.showAuthSheet.value = false
                val target = session.pendingRoute ?: if (mode == "login") "me" else "create"
                session.pendingRoute = null
                goTab(nav, target)
            } catch (e: Exception) {
                error = (e as? ApiException)?.message ?: "请求失败，请重试"
            } finally {
                busy = false
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = { session.showAuthSheet.value = false; session.pendingRoute = null },
        sheetState = sheetState,
        containerColor = c.surface1,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(horizontal = AppSize.s5.dp).padding(bottom = AppSize.s8.dp),
            verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
        ) {
            Segmented(
                options = listOf("login" to "登录", "register" to "注册"),
                selection = mode,
            ) { mode = it; error = null }

            FieldLabel("邮箱")
            OutlinedTextField(
                value = email, onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                colors = htFieldColors(),
            )
            FieldLabel("密码", hint = if (mode == "register") "至少 8 位且含字母和数字" else null)
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = htFieldColors(),
            )

            if (mode == "register") {
                FieldLabel("昵称")
                OutlinedTextField(
                    value = nickname, onValueChange = { nickname = it },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    colors = htFieldColors(),
                )
                FieldLabel("挑一个头像")
                AvatarPicker(avatars = avatars, selected = avatarId, onSelect = { avatarId = it })
            }

            error?.let { HtAlert(AlertVariant.Danger, it) }

            HtButton(
                if (busy) "请稍候…" else if (mode == "login") "登录" else "注册并开始",
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy && email.isNotBlank() && password.isNotBlank() &&
                    (mode == "login" || (nickname.isNotBlank() && avatarId != null)),
            ) { submit() }
        }
    }
}

/** 头像九宫格（注册 / 账号设置共用）。 */
@Composable
fun AvatarPicker(avatars: List<Avatar>, selected: String?, onSelect: (String) -> Unit) {
    val c = HT.colors
    if (avatars.isEmpty()) {
        Text("头像加载中…", color = c.textMuted, fontSize = AppSize.fsSm.sp)
        return
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        modifier = Modifier.fillMaxWidth().padding(vertical = AppSize.s1.dp),
        horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s2.dp),
        userScrollEnabled = false,
    ) {
        items(avatars, key = { it.id }) { a ->
            val active = a.id == selected
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(c.surface2)
                    .border(
                        if (active) 2.dp else 1.dp,
                        if (active) c.signalPrimary else c.borderSubtle,
                        CircleShape,
                    )
                    .clickable { onSelect(a.id) }
                    .padding(4.dp),
            ) {
                AvatarView(a.id, a.name, 44.dp)
            }
        }
    }
}
