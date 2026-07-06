// 复用组件：按钮（变体×尺寸）/ 卡片容器 / Alert / 分段控件 / 分页条 / 空态 / 输入框。
// 对齐 React cy-btn / cy-card / cy-alert 等类；辉光用彩色 shadow（API 28+ 生效）。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT

enum class BtnVariant { Primary, Ghost, Success, Danger, HeroPrimary, HeroSuccess }
enum class BtnSize { Sm, Md }

/** 流光渐变（hero CTA 专属，对齐 cyber.css 的 primary/success flow）。 */
object AppGradients {
    val cyberFlow: Brush
        @Composable get() = Brush.linearGradient(
            listOf(HT.colors.signalPrimary, HT.colors.brandPrimary),
        )
    val mintFlow: Brush
        @Composable get() = Brush.linearGradient(
            listOf(HT.colors.successSolid, HT.colors.signalPrimary),
        )
}

@Composable
fun HtButton(
    label: String,
    modifier: Modifier = Modifier,
    variant: BtnVariant = BtnVariant.Primary,
    size: BtnSize = BtnSize.Md,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    onClick: () -> Unit,
) {
    val c = HT.colors
    val isHero = variant == BtnVariant.HeroPrimary || variant == BtnVariant.HeroSuccess
    val shape = if (isHero) RoundedCornerShape(AppSize.radiusFull.dp) else RoundedCornerShape(AppSize.radiusMd.dp)
    val vPad = if (isHero) 14.dp else if (size == BtnSize.Sm) 6.dp else 10.dp
    val hPad = if (isHero) 28.dp else if (size == BtnSize.Sm) 12.dp else 18.dp
    val fs = if (isHero) AppSize.fsLg.sp else if (size == BtnSize.Sm) AppSize.fsSm.sp else AppSize.fsBase.sp

    val fg = when (variant) {
        BtnVariant.Primary -> c.signalOn
        BtnVariant.Success -> c.successOn
        BtnVariant.HeroPrimary, BtnVariant.HeroSuccess -> Color.White
        BtnVariant.Ghost -> c.textPrimary
        BtnVariant.Danger -> c.dangerFg
    }
    val glow = when (variant) {
        BtnVariant.Primary, BtnVariant.HeroPrimary -> c.signalPrimary.copy(alpha = 0.55f)
        BtnVariant.Success, BtnVariant.HeroSuccess -> c.successSolid.copy(alpha = 0.5f)
        else -> Color.Transparent
    }

    var m = modifier
    if (glow != Color.Transparent && enabled) {
        m = m.shadow(10.dp, shape, ambientColor = glow, spotColor = glow)
    }
    m = m.clip(shape)
    m = when (variant) {
        BtnVariant.HeroPrimary -> m.background(AppGradients.cyberFlow)
        BtnVariant.HeroSuccess -> m.background(AppGradients.mintFlow)
        BtnVariant.Primary -> m.background(c.signalPrimary)
        BtnVariant.Success -> m.background(c.successSolid)
        BtnVariant.Ghost -> m.border(1.dp, c.borderDefault, shape)
        BtnVariant.Danger -> m.border(1.dp, c.dangerBorder, shape)
    }
    m = m.clickable(enabled = enabled) { onClick() }.padding(horizontal = hPad, vertical = vPad)

    Row(modifier = m, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.width(18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            color = if (enabled) fg else fg.copy(alpha = 0.5f),
            fontSize = fs,
            fontWeight = if (isHero) FontWeight.Bold else FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

/** 卡片容器（= cy-card）。 */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    padding: PaddingValues = PaddingValues(AppSize.s5.dp),
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val c = HT.colors
    val shape = RoundedCornerShape(AppSize.radiusLg.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(c.surface1)
            .border(1.dp, c.borderSubtle, shape)
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(AppSize.s4.dp),
        content = content,
    )
}

enum class AlertVariant { Info, Success, Danger }

@Composable
fun HtAlert(variant: AlertVariant, text: String) {
    val c = HT.colors
    val (fg, bg) = when (variant) {
        AlertVariant.Info -> c.textLink to c.surface2
        AlertVariant.Success -> c.successFg to c.successBg
        AlertVariant.Danger -> c.dangerFg to c.dangerBg
    }
    val shape = RoundedCornerShape(AppSize.radiusMd.dp)
    Row(
        modifier = Modifier.fillMaxWidth().clip(shape).background(bg.copy(alpha = 0.6f))
            .border(1.dp, fg.copy(alpha = 0.3f), shape).padding(AppSize.s3.dp),
    ) {
        Text(text, color = c.textSecondary, fontSize = AppSize.fsSm.sp)
    }
}

/** 分段控件（排序/筛选/登录注册切换）：等分全宽（= RN flex:1 / iOS Segmented）。 */
@Composable
fun Segmented(
    options: List<Pair<String, String>>,
    selection: String,
    modifier: Modifier = Modifier,
    onChange: (String) -> Unit,
) {
    val c = HT.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppSize.radiusFull.dp))
            .background(c.surface2)
            .border(1.dp, c.borderSubtle, RoundedCornerShape(AppSize.radiusFull.dp))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { (key, label) ->
            val active = key == selection
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .background(if (active) c.signalPrimary else Color.Transparent)
                    .clickable { if (!active) onChange(key) }
                    .padding(vertical = 7.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (active) c.signalOn else c.textSecondary,
                    fontSize = AppSize.fsSm.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

/** 分页条：上一页 / x / y / 下一页 + 总数。 */
@Composable
fun PaginationBar(page: Int, totalPages: Int, total: Int, onChange: (Int) -> Unit) {
    if (totalPages <= 1) return
    val c = HT.colors
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = AppSize.s4.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HtButton("上一页", variant = BtnVariant.Ghost, size = BtnSize.Sm, enabled = page > 1) { onChange(page - 1) }
        Text(
            "  $page / $totalPages · 共 $total 条  ",
            color = c.textMuted, fontSize = AppSize.fsSm.sp,
        )
        HtButton("下一页", variant = BtnVariant.Ghost, size = BtnSize.Sm, enabled = page < totalPages) { onChange(page + 1) }
    }
}

@Composable
fun EmptyState(emoji: String, text: String, cta: String? = null, onCta: (() -> Unit)? = null) {
    val c = HT.colors
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = AppSize.s12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp),
    ) {
        Text(emoji, fontSize = 40.sp)
        Text(text, color = c.textMuted, fontSize = AppSize.fsBase.sp, textAlign = TextAlign.Center)
        if (cta != null && onCta != null) {
            HtButton(cta, variant = BtnVariant.Ghost, size = BtnSize.Sm, onClick = onCta)
        }
    }
}

@Composable
fun FieldLabel(text: String, hint: String? = null) {
    val c = HT.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(text, color = c.textSecondary, fontSize = AppSize.fsSm.sp, fontWeight = FontWeight.Medium)
        if (hint != null) {
            Spacer(Modifier.width(AppSize.s2.dp))
            Text(hint, color = c.textMuted, fontSize = AppSize.fsXs.sp)
        }
    }
}

/** OutlinedTextField 的语义色配色（各表单共用）。 */
@Composable
fun htFieldColors(): TextFieldColors {
    val c = HT.colors
    return OutlinedTextFieldDefaults.colors(
        focusedTextColor = c.textPrimary,
        unfocusedTextColor = c.textPrimary,
        focusedContainerColor = c.surface3,
        unfocusedContainerColor = c.surface3,
        focusedBorderColor = c.signalPrimary,
        unfocusedBorderColor = c.borderDefault,
        cursorColor = c.signalPrimary,
        focusedPlaceholderColor = c.textDisabled,
        unfocusedPlaceholderColor = c.textDisabled,
    )
}

@Composable
fun VSpace(px: Float) = Spacer(Modifier.height(px.dp))
