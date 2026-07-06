// 远程 SVG 渲染：Coil 3 + SvgDecoder（Android 的 ImageView/Coil 不原生认 SVG，
// 与 iOS 需要 SVGView 同因）。头像加载失败退化为首字母徽章。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.SubcomposeAsyncImage
import pro.hellotime.android.AppGraph
import pro.hellotime.android.theme.HT

/** 头像：后端 /static/avatars/<id>.svg；加载中/失败显示首字母徽章。 */
@Composable
fun AvatarView(avatarId: String?, nickname: String, size: Dp = 36.dp) {
    val url = avatarId?.let { AppGraph.api.resolveAsset("/static/avatars/$it.svg") }
    if (url == null) {
        AvatarBadge(nickname, size)
        return
    }
    SubcomposeAsyncImage(
        model = url,
        contentDescription = nickname,
        modifier = Modifier.size(size).clip(CircleShape),
        loading = { AvatarBadge(nickname, size) },
        error = { AvatarBadge(nickname, size) },
    )
}

@Composable
fun AvatarBadge(nickname: String, size: Dp = 36.dp) {
    val c = HT.colors
    val initial = nickname.trim().take(1).uppercase().ifEmpty { "?" }
    Box(
        modifier = Modifier.size(size).clip(CircleShape)
            .background(Brush.linearGradient(listOf(c.brandPrimary, c.brandHover))),
        contentAlignment = Alignment.Center,
    ) {
        Text(initial, color = androidx.compose.ui.graphics.Color.White, fontSize = (size.value * 0.42).sp, fontWeight = FontWeight.Bold)
    }
}

/** 通用远程 SVG 图标（技术栈图标等）。 */
@Composable
fun SvgIcon(url: String, size: Dp = 20.dp) {
    SubcomposeAsyncImage(
        model = url,
        contentDescription = null,
        modifier = Modifier.size(size),
        loading = { Box(Modifier.size(size)) },
        error = { Box(Modifier.size(size)) },
    )
}
