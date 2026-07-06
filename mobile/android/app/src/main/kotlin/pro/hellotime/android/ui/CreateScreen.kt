// 创建胶囊：标题 + AI 生成 + 推荐灵感 + 内容 + 开启时刻（日期/时间对话框 + 快捷预设）
// + 广场开关 + 成功页（码 + 复制 + 详情）。= React CreatePage / mobile/ios CreateView。
package pro.hellotime.android.ui

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import kotlinx.coroutines.launch
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.CapsuleDetail
import pro.hellotime.android.data.CapsuleRecommendation
import pro.hellotime.android.data.CapsuleSuggestionRequest
import pro.hellotime.android.data.CreateCapsuleRequest
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT
import pro.hellotime.android.util.DateUtil
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

@Composable
fun CreateScreen(nav: NavHostController) {
    val c = HT.colors
    val scope = rememberCoroutineScope()

    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var openAt by remember { mutableStateOf(LocalDateTime.now().plusDays(1).withSecond(0).withNano(0)) }
    var inPlaza by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var aiBusy by remember { mutableStateOf(false) }
    var aiInfo by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var created by remember { mutableStateOf<CapsuleDetail?>(null) }

    var recos by remember { mutableStateOf<List<CapsuleRecommendation>>(emptyList()) }
    var recoBusy by remember { mutableStateOf(false) }

    fun loadRecommendations() {
        recoBusy = true
        scope.launch {
            runCatching { AppGraph.api.capsuleRecommendations(count = 4, locale = "zh-CN") }
                .onSuccess { recos = it.items }
            recoBusy = false
        }
    }
    LaunchedEffect(Unit) { loadRecommendations() }

    fun aiGenerate() {
        aiBusy = true; aiInfo = null; error = null
        scope.launch {
            try {
                val s = AppGraph.api.suggestCapsule(
                    CapsuleSuggestionRequest(title = title.trim().ifEmpty { null }, locale = "zh-CN"),
                )
                s.title?.let { title = it }
                content = s.content
                openAt = LocalDateTime.ofInstant(DateUtil.parse(s.openAt), ZoneId.systemDefault())
                aiInfo = "已为你生成内容并建议解封时间（${s.openInDays} 天后，${s.generatedBy}）"
            } catch (e: Exception) {
                error = (e as? ApiException)?.message ?: "AI 生成失败，请稍后再试"
            } finally {
                aiBusy = false
            }
        }
    }

    fun submit() {
        busy = true; error = null
        scope.launch {
            try {
                created = AppGraph.api.createCapsule(
                    CreateCapsuleRequest(
                        title = title.trim(), content = content.trim(),
                        openAt = DateUtil.isoFrom(openAt), inPlaza = inPlaza,
                    ),
                )
            } catch (e: Exception) {
                error = (e as? ApiException)?.message ?: "创建失败"
            } finally {
                busy = false
            }
        }
    }

    created?.let { cap ->
        SuccessView(nav, cap) {
            created = null; title = ""; content = ""
            openAt = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = AppSize.s4.dp, vertical = AppSize.s4.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
    ) {
        Text("写给未来的信", color = c.textPrimary, fontSize = AppSize.fs2xl.sp, fontWeight = FontWeight.Bold)

        FieldLabel("胶囊标题", hint = "${title.length}/60")
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp)) {
            OutlinedTextField(
                value = title, onValueChange = { if (it.length <= 60) title = it },
                modifier = Modifier.weight(1f), singleLine = true,
                placeholder = { Text("如「写给三年后的自己」", fontSize = AppSize.fsSm.sp) },
                colors = htFieldColors(),
            )
            HtButton(if (aiBusy) "…" else "✨ AI", variant = BtnVariant.Ghost, size = BtnSize.Sm, enabled = !aiBusy) { aiGenerate() }
        }
        aiInfo?.let { Text(it, color = c.textMuted, fontSize = AppSize.fsXs.sp) }

        // AI 推荐灵感
        if (recos.isNotEmpty() || recoBusy) {
            SectionCard(padding = androidx.compose.foundation.layout.PaddingValues(AppSize.s3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("✨ 没有头绪？试试这些灵感", color = c.textMuted, fontSize = AppSize.fsXs.sp)
                    Spacer(Modifier.weight(1f))
                    HtButton(if (recoBusy) "…" else "换一批", variant = BtnVariant.Ghost, size = BtnSize.Sm, enabled = !recoBusy) {
                        loadRecommendations()
                    }
                }
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp),
                ) {
                    recos.forEach { r ->
                        HtButton(r.title, variant = BtnVariant.Ghost, size = BtnSize.Sm) {
                            title = r.title
                            openAt = LocalDateTime.now().plusDays(r.openInDays.toLong()).withSecond(0).withNano(0)
                            aiInfo = r.hint
                        }
                    }
                }
            }
        }

        FieldLabel("内容", hint = "${content.length}/5000 · 上锁后不可修改")
        OutlinedTextField(
            value = content, onValueChange = { if (it.length <= 5000) content = it },
            modifier = Modifier.fillMaxWidth().height(160.dp),
            placeholder = { Text("写下你想传递到未来的话。到点之前，任何人（包括你自己）都无法开启。", fontSize = AppSize.fsSm.sp) },
            colors = htFieldColors(),
        )

        FieldLabel("开启时刻")
        DateTimeField(value = openAt, onChange = { openAt = it })

        // 快捷预设
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp),
        ) {
            listOf(
                "1分钟后" to { LocalDateTime.now().plusMinutes(2).withSecond(0).withNano(0) },
                "1小时后" to { LocalDateTime.now().plusHours(1).withSecond(0).withNano(0) },
                "明天9:00" to { LocalDate.now().plusDays(1).atTime(9, 0) },
                "1年后" to { LocalDateTime.now().plusYears(1).withSecond(0).withNano(0) },
                "2030元旦" to { LocalDate.of(2030, 1, 1).atStartOfDay() },
            ).forEach { (label, calc) ->
                HtButton(label, variant = BtnVariant.Ghost, size = BtnSize.Sm) { openAt = calc() }
            }
        }

        // 广场开关
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("投放到胶囊广场", color = c.textPrimary, fontSize = AppSize.fsBase.sp, fontWeight = FontWeight.Medium)
                Text(
                    "开启后标题和倒计时对所有人可见；关闭则仅持码人可访问。",
                    color = c.textMuted, fontSize = AppSize.fsXs.sp,
                )
            }
            Switch(
                checked = inPlaza, onCheckedChange = { inPlaza = it },
                colors = SwitchDefaults.colors(
                    checkedTrackColor = c.signalPrimary,
                    checkedThumbColor = c.signalOn,
                ),
            )
        }

        error?.let { HtAlert(AlertVariant.Danger, it) }

        HtButton(
            if (busy) "封存中…" else "🔒 上锁封存",
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy && title.isNotBlank() && content.isNotBlank(),
        ) { submit() }
        VSpace(AppSize.s8)
    }
}

/** 日期 + 时间选择（M3 DatePickerDialog + TimePicker 对话框），单行展示值与距开启。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateTimeField(value: LocalDateTime, onChange: (LocalDateTime) -> Unit) {
    val c = HT.colors
    var showDate by remember { mutableStateOf(false) }
    var showTime by remember { mutableStateOf(false) }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp)) {
        Text(
            "${value.toLocalDate()} ${"%02d:%02d".format(value.hour, value.minute)}",
            color = c.textPrimary, fontSize = AppSize.fsBase.sp,
            fontWeight = FontWeight.Medium, fontFamily = FontFamily.Monospace,
        )
        Text(
            DateUtil.distance(DateUtil.isoFrom(value)),
            color = c.textMuted, fontSize = AppSize.fsXs.sp, modifier = Modifier.weight(1f),
        )
        HtButton("日期", variant = BtnVariant.Ghost, size = BtnSize.Sm) { showDate = true }
        HtButton("时间", variant = BtnVariant.Ghost, size = BtnSize.Sm) { showTime = true }
    }

    if (showDate) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = value.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        val d = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                        onChange(LocalDateTime.of(d, LocalTime.of(value.hour, value.minute)))
                    }
                    showDate = false
                }) { Text("确定") }
            },
            dismissButton = { TextButton(onClick = { showDate = false }) { Text("取消") } },
        ) { DatePicker(state = state) }
    }

    if (showTime) {
        val state = rememberTimePickerState(initialHour = value.hour, initialMinute = value.minute, is24Hour = true)
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showTime = false },
            containerColor = c.surface1,
            confirmButton = {
                TextButton(onClick = {
                    onChange(LocalDateTime.of(value.toLocalDate(), LocalTime.of(state.hour, state.minute)))
                    showTime = false
                }) { Text("确定") }
            },
            dismissButton = { TextButton(onClick = { showTime = false }) { Text("取消") } },
            text = { TimePicker(state = state) },
        )
    }
}

/** 创建成功：徽章 + 码（复制）+ 查看详情 / 再写一封。 */
@Composable
private fun SuccessView(nav: NavHostController, cap: CapsuleDetail, onReset: () -> Unit) {
    val c = HT.colors
    val clipboard = LocalClipboardManager.current
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(AppSize.s5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
    ) {
        VSpace(AppSize.s8)
        Text("🎉", fontSize = 52.sp)
        Text("胶囊已封存！", color = c.textPrimary, fontSize = AppSize.fs2xl.sp, fontWeight = FontWeight.Bold)
        Text(
            "将于 ${DateUtil.display(cap.openAt)} 解封。把胶囊码分享给未来的开启人：",
            color = c.textSecondary, fontSize = AppSize.fsSm.sp,
        )
        SectionCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                Text(
                    cap.code, color = c.signalPrimary, fontSize = AppSize.fs2xl.sp,
                    fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                )
                Spacer(Modifier.width(AppSize.s3.dp))
                HtButton("复制", variant = BtnVariant.Ghost, size = BtnSize.Sm) {
                    clipboard.setText(AnnotatedString(cap.code))
                }
            }
        }
        HtButton("查看详情", modifier = Modifier.fillMaxWidth()) { nav.navigate("capsule/${cap.code}") }
        HtButton("再写一封", modifier = Modifier.fillMaxWidth(), variant = BtnVariant.Ghost, onClick = onReset)
    }
}
