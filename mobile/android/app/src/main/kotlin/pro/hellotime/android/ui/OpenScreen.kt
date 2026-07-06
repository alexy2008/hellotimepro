// 开启胶囊：8 位码分格输入（隐藏 BasicTextField + 8 格显示，软键盘退格天然可用）+ 粘贴 + 提交。
// = mobile/ios OpenView / React OpenPage。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

private const val CODE_LEN = 8

@Composable
fun OpenScreen(nav: NavHostController) {
    val c = HT.colors
    val clipboard = LocalClipboardManager.current
    var code by remember { mutableStateOf("") }

    fun sanitize(raw: String) = raw.uppercase().filter { it.isLetterOrDigit() }.take(CODE_LEN)

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = AppSize.s4.dp, vertical = AppSize.s6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppSize.s5.dp),
    ) {
        Text("🔑", fontSize = 44.sp)
        Text(
            "输入朋友分享给你的 8 位胶囊码（大写字母和数字），可直接查看胶囊。",
            color = c.textSecondary, fontSize = AppSize.fsSm.sp, textAlign = TextAlign.Center,
        )

        CodeInput(code = code, onChange = { code = sanitize(it) })

        Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s3.dp)) {
            HtButton("粘贴", variant = BtnVariant.Ghost, size = BtnSize.Sm) {
                clipboard.getText()?.text?.let { code = sanitize(it) }
            }
            if (code.isNotEmpty()) {
                HtButton("清空", variant = BtnVariant.Ghost, size = BtnSize.Sm) { code = "" }
            }
        }

        HtButton(
            "开启胶囊 →",
            modifier = Modifier.fillMaxWidth(),
            variant = BtnVariant.Primary,
            enabled = code.length == CODE_LEN,
        ) { nav.navigate("capsule/$code") }
    }
}

/** 8 位码输入：隐藏输入框承接软键盘，8 个显示格渲染字符与光标位。 */
@Composable
private fun CodeInput(code: String, onChange: (String) -> Unit) {
    val c = HT.colors
    BasicTextField(
        value = code,
        onValueChange = onChange,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Ascii,
            capitalization = KeyboardCapitalization.Characters,
        ),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(AppSize.s2.dp)) {
                repeat(CODE_LEN) { i ->
                    val ch = code.getOrNull(i)?.toString() ?: ""
                    val focused = i == code.length
                    Box(
                        modifier = Modifier
                            .size(38.dp, 48.dp)
                            .clip(RoundedCornerShape(AppSize.radiusMd.dp))
                            .background(c.surface2)
                            .border(
                                1.dp,
                                if (focused) c.signalPrimary else c.borderSubtle,
                                RoundedCornerShape(AppSize.radiusMd.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            ch,
                            color = c.signalPrimary,
                            fontSize = AppSize.fsXl.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
        },
    )
}
