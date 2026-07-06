// ============================================================
// 自动生成 · 请勿手改 (AUTO-GENERATED — DO NOT EDIT)
//
// 由 scripts/gen-tokens-android 从 spec/tokens/tokens.json 生成。
// 重新生成：node scripts/gen-tokens-android
// 源（事实源）：spec/styles/tokens.css → spec/tokens/tokens.json
//
// rem 已折算为 px Float（1rem=16px）；颜色→Color、渐变→Brush、
// 辉光→Color + <名>Blur。消费入口见 theme/Theme.kt。
// ============================================================
package pro.hellotime.android.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight

/** 间距 / 圆角 / 字号 / 布局（主题无关 px 常量）。 */
object AppSize {
    const val s0 = 0f
    const val s1 = 4f
    const val s2 = 8f
    const val s3 = 12f
    const val s4 = 16f
    const val s5 = 20f
    const val s6 = 24f
    const val s8 = 32f
    const val s10 = 40f
    const val s12 = 48f
    const val s16 = 64f
    const val s20 = 80f

    const val radiusXs = 2f
    const val radiusSm = 4f
    const val radiusMd = 8f
    const val radiusLg = 12f
    const val radiusXl = 16f
    const val radius2xl = 24f
    const val radiusFull = 9999f

    const val fsXs = 12f
    const val fsSm = 14f
    const val fsBase = 16f
    const val fsLg = 18f
    const val fsXl = 20f
    const val fs2xl = 24f
    const val fs3xl = 30f
    const val fs4xl = 36f
    const val fs5xl = 48f

    const val containerMax = 1200f
    const val containerNarrow = 720f
    const val headerHeight = 64f
    const val footerHeight = 64f
}

/** 字体族（fallback 列表）与字重。 */
object AppFont {
    val sans = listOf("Inter", "HarmonyOS Sans SC", "PingFang SC", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Noto Sans CJK SC", "sans-serif")
    val mono = listOf("JetBrains Mono", "Fira Code", "SF Mono", "Menlo", "Consolas", "monospace")
    val display = listOf("Orbitron", "Exo 2", "Inter", "HarmonyOS Sans SC", "PingFang SC", "sans-serif")

    val regular = FontWeight(400)
    val medium = FontWeight(500)
    val semibold = FontWeight(600)
    val bold = FontWeight(700)
}

/** 语义色板（每主题一套；字段由 codegen 生成）。 */
class SemanticColors(
    val surface0: Color,
    val surface1: Color,
    val surface2: Color,
    val surface3: Color,
    val surfaceRaised: Color,
    val surfaceOverlay: Color,
    val borderSubtle: Color,
    val borderDefault: Color,
    val borderStrong: Color,
    val borderFocus: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textDisabled: Color,
    val textInverse: Color,
    val textLink: Color,
    val textLinkHover: Color,
    val brandPrimary: Color,
    val brandHover: Color,
    val brandPressed: Color,
    val brandSubtle: Color,
    val brandOn: Color,
    val accentPrimary: Color,
    val accentHover: Color,
    val accentSubtle: Color,
    val accentOn: Color,
    val signalPrimary: Color,
    val signalHover: Color,
    val signalSubtle: Color,
    val signalOn: Color,
    val successBg: Color,
    val successFg: Color,
    val successBorder: Color,
    val successSolid: Color,
    val successOn: Color,
    val warningBg: Color,
    val warningFg: Color,
    val warningBorder: Color,
    val warningSolid: Color,
    val dangerBg: Color,
    val dangerFg: Color,
    val dangerBorder: Color,
    val dangerSolid: Color,
    val plazaCardBg: Color,
    val plazaCardHover: Color,
    val plazaCardBorder: Color,
    val plazaDivider: Color,
    val plazaGlow: Color,
    val capsuleSealedBorder: Color,
    val capsuleSealedAccent: Color,
    val capsuleSealedGlow: Color,
    val capsuleSealedGlowBlur: Float,
    val capsuleOpenedSubtle: Color,
    val capsuleOpenedBorder: Color,
    val capsuleOpenedAccent: Color,
    val capsuleOpenedGlow: Color,
    val capsuleOpenedGlowBlur: Float,
    val favoriteActive: Color,
    val favoriteInactive: Color,
    val gradientBrandHero: Brush,
    val gradientBrandSubtle: Brush,
)

val darkColors = SemanticColors(
    surface0 = Color(0xFF06060C),
    surface1 = Color(0xFF0D0D15),
    surface2 = Color(0xFF181824),
    surface3 = Color(0xFF262635),
    surfaceRaised = Color(0xFF181824),
    surfaceOverlay = Color(0xB806060C),
    borderSubtle = Color(0xFF262635),
    borderDefault = Color(0xFF3A3A4D),
    borderStrong = Color(0xFF55556A),
    borderFocus = Color(0xFF8467FF),
    textPrimary = Color(0xFFF7F7FB),
    textSecondary = Color(0xFFD7D7E2),
    textMuted = Color(0xFF80808F),
    textDisabled = Color(0xFF55556A),
    textInverse = Color(0xFF0D0D15),
    textLink = Color(0xFF40E4FF),
    textLinkHover = Color(0xFF80EFFF),
    brandPrimary = Color(0xFF6B46FF),
    brandHover = Color(0xFF8467FF),
    brandPressed = Color(0xFF5A34EE),
    brandSubtle = Color(0xFF341A8F),
    brandOn = Color(0xFFF7F7FB),
    accentPrimary = Color(0xFFFF2D91),
    accentHover = Color(0xFFFF4FA0),
    accentSubtle = Color(0xFF7E0844),
    accentOn = Color(0xFFF7F7FB),
    signalPrimary = Color(0xFF14D4F0),
    signalHover = Color(0xFF40E4FF),
    signalSubtle = Color(0xFF004B59),
    signalOn = Color(0xFF06060C),
    successBg = Color(0xFF08402A),
    successFg = Color(0xFF5ED49A),
    successBorder = Color(0xFF0F6B41),
    successSolid = Color(0xFF1AA866),
    successOn = Color(0xFF06060C),
    warningBg = Color(0xFF5A3700),
    warningFg = Color(0xFFFFC14A),
    warningBorder = Color(0xFFA46400),
    warningSolid = Color(0xFFF29D0A),
    dangerBg = Color(0xFF4A1A1A),
    dangerFg = Color(0xFFD47A7A),
    dangerBorder = Color(0xFF8A2E2E),
    dangerSolid = Color(0xFFB84040),
    plazaCardBg = Color(0xFF0D0D15),
    plazaCardHover = Color(0xFF181824),
    plazaCardBorder = Color(0xFF262635),
    plazaDivider = Color(0xFF181824),
    plazaGlow = Color(0x596B46FF),
    capsuleSealedBorder = Color(0xFF00B8D4),
    capsuleSealedAccent = Color(0xFF40E4FF),
    capsuleSealedGlow = Color(0x7314D4F0),
    capsuleSealedGlowBlur = 24f,
    capsuleOpenedSubtle = Color(0xFF08402A),
    capsuleOpenedBorder = Color(0xFF1AA866),
    capsuleOpenedAccent = Color(0xFF5ED49A),
    capsuleOpenedGlow = Color(0x615ED49A),
    capsuleOpenedGlowBlur = 18f,
    favoriteActive = Color(0xFFFF2D91),
    favoriteInactive = Color(0xFF80808F),
    gradientBrandHero = Brush.linearGradient(colorStops = arrayOf(0f to Color(0xFF40E4FF), 0.5f to Color(0xFFFF4FA0), 1f to Color(0xFF5ED49A)), start = Offset.Zero, end = Offset.Infinite),
    gradientBrandSubtle = Brush.linearGradient(listOf(Color(0x2614D4F0), Color(0x1AFF4FA0), Color(0x145ED49A)), start = Offset.Zero, end = Offset.Infinite),
)

val lightColors = SemanticColors(
    surface0 = Color(0xFFF7F7FB),
    surface1 = Color(0xFFFFFFFF),
    surface2 = Color(0xFFEEEEF4),
    surface3 = Color(0xFFD7D7E2),
    surfaceRaised = Color(0xFFFFFFFF),
    surfaceOverlay = Color(0x7A0D0D15),
    borderSubtle = Color(0xFFD7D7E2),
    borderDefault = Color(0xFFB0B0C0),
    borderStrong = Color(0xFF80808F),
    borderFocus = Color(0xFF6B46FF),
    textPrimary = Color(0xFF0D0D15),
    textSecondary = Color(0xFF262635),
    textMuted = Color(0xFF55556A),
    textDisabled = Color(0xFF80808F),
    textInverse = Color(0xFFF7F7FB),
    textLink = Color(0xFF5A34EE),
    textLinkHover = Color(0xFF6B46FF),
    brandPrimary = Color(0xFF5A34EE),
    brandHover = Color(0xFF6B46FF),
    brandPressed = Color(0xFF4824C4),
    brandSubtle = Color(0xFFE4DCFF),
    brandOn = Color(0xFFFFFFFF),
    accentPrimary = Color(0xFFE01778),
    accentHover = Color(0xFFFF2D91),
    accentSubtle = Color(0xFFFFD9EC),
    accentOn = Color(0xFFFFFFFF),
    signalPrimary = Color(0xFF0090A8),
    signalHover = Color(0xFF00B8D4),
    signalSubtle = Color(0xFFBFF7FF),
    signalOn = Color(0xFFFFFFFF),
    successBg = Color(0xFFE8FBF1),
    successFg = Color(0xFF0F6B41),
    successBorder = Color(0xFF5ED49A),
    successSolid = Color(0xFF1AA866),
    successOn = Color(0xFFFFFFFF),
    warningBg = Color(0xFFFFF5E0),
    warningFg = Color(0xFFA46400),
    warningBorder = Color(0xFFFFC14A),
    warningSolid = Color(0xFFF29D0A),
    dangerBg = Color(0xFFFDF0F0),
    dangerFg = Color(0xFF8A2E2E),
    dangerBorder = Color(0xFFD47A7A),
    dangerSolid = Color(0xFFB84040),
    plazaCardBg = Color(0xFFFFFFFF),
    plazaCardHover = Color(0xFFF7F7FB),
    plazaCardBorder = Color(0xFFD7D7E2),
    plazaDivider = Color(0xFFEEEEF4),
    plazaGlow = Color(0x2E6B46FF),
    capsuleSealedBorder = Color(0xFF00B8D4),
    capsuleSealedAccent = Color(0xFF006D80),
    capsuleSealedGlow = Color(0x3800B8D4),
    capsuleSealedGlowBlur = 18f,
    capsuleOpenedSubtle = Color(0xFFC2F2D8),
    capsuleOpenedBorder = Color(0xFF1AA866),
    capsuleOpenedAccent = Color(0xFF0F6B41),
    capsuleOpenedGlow = Color(0x335ED49A),
    capsuleOpenedGlowBlur = 12f,
    favoriteActive = Color(0xFFFF2D91),
    favoriteInactive = Color(0xFF80808F),
    gradientBrandHero = Brush.linearGradient(colorStops = arrayOf(0f to Color(0xFF14D4F0), 0.5f to Color(0xFFFF2D91), 1f to Color(0xFF1AA866)), start = Offset.Zero, end = Offset.Infinite),
    gradientBrandSubtle = Brush.linearGradient(listOf(Color(0x1A14D4F0), Color(0x12FF2D91), Color(0x0F1AA866)), start = Offset.Zero, end = Offset.Infinite),
)
