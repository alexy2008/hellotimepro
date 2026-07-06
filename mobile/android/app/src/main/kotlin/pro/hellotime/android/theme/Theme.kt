// 主题装配：语义色板（codegen 的 Tokens.kt）经 CompositionLocal 下发全树，
// 同时把关键语义色映射进 Material 3 colorScheme（让 Material 组件默认观感一致）。
// = React ThemeProvider / SwiftUI Theme / Flutter app_theme.dart。
package pro.hellotime.android.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

val LocalColors = staticCompositionLocalOf { darkColors }

/** 取当前语义色板：`val c = HT.colors`（对齐各端 `context.colors` / `Theme.xxx` 用法）。 */
object HT {
    val colors: SemanticColors
        @Composable get() = LocalColors.current
}

@Composable
fun HelloTimeTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val c = if (dark) darkColors else lightColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.signalPrimary,
            onPrimary = c.signalOn,
            secondary = c.brandPrimary,
            onSecondary = c.brandOn,
            background = c.surface0,
            onBackground = c.textPrimary,
            surface = c.surface1,
            onSurface = c.textPrimary,
            surfaceVariant = c.surface2,
            onSurfaceVariant = c.textSecondary,
            outline = c.borderDefault,
            error = c.dangerSolid,
        )
    } else {
        lightColorScheme(
            primary = c.signalPrimary,
            onPrimary = c.signalOn,
            secondary = c.brandPrimary,
            onSecondary = c.brandOn,
            background = c.surface0,
            onBackground = c.textPrimary,
            surface = c.surface1,
            onSurface = c.textPrimary,
            surfaceVariant = c.surface2,
            onSurfaceVariant = c.textSecondary,
            outline = c.borderDefault,
            error = c.dangerSolid,
        )
    }
    // 状态栏/导航栏图标深浅要跟着「应用内主题」联动（不是系统暗色模式）——
    // enableEdgeToEdge() 只在启动时按系统状态设过一次，主题切换按钮不会触发它更新，
    // 深色背景配深色图标就成了「隐形」。SideEffect 在每次 dark 变化后同步一次。
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }
    }

    CompositionLocalProvider(LocalColors provides c) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
