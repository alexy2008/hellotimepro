// 胶囊卡片：状态徽章 + 标题 + （已开启）内容预览 + 创建者 + 收藏。
// 密封/已开启各配边色 + 辉光（= React cy-capsule / iOS CapsuleCard，无 hover 态）。
package pro.hellotime.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.hellotime.android.AppGraph
import pro.hellotime.android.data.ApiException
import pro.hellotime.android.data.CapsuleListItem
import pro.hellotime.android.theme.AppSize
import pro.hellotime.android.theme.HT
import pro.hellotime.android.util.DateUtil

@Composable
fun CapsuleCard(
    capsule: CapsuleListItem,
    showCreator: Boolean = true,
    hideFavorite: Boolean = false,
    rightSlot: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    val c = HT.colors
    val shape = RoundedCornerShape(AppSize.radiusLg.dp)
    val border = if (capsule.isOpened) c.capsuleOpenedBorder else c.capsuleSealedBorder
    val glow = if (capsule.isOpened) c.capsuleOpenedGlow else c.capsuleSealedGlow

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(8.dp, shape, ambientColor = glow, spotColor = glow)
            .clip(shape)
            .background(c.plazaCardBg)
            .border(1.dp, border, shape)
            .clickable { onClick() }
            .padding(AppSize.s4.dp),
        verticalArrangement = Arrangement.spacedBy(AppSize.s3.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusBadge(opened = capsule.isOpened)
            Spacer(Modifier.weight(1f))
            Text(
                if (capsule.isOpened) "开启于 ${DateUtil.display(capsule.openAt)}" else DateUtil.distance(capsule.openAt),
                color = if (capsule.isOpened) c.textMuted else c.capsuleSealedAccent,
                fontSize = AppSize.fsXs.sp,
            )
        }

        Text(
            capsule.title,
            color = c.textPrimary,
            fontSize = AppSize.fsLg.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        if (capsule.isOpened && !capsule.contentPreview.isNullOrBlank()) {
            Text(
                capsule.contentPreview,
                color = c.textSecondary,
                fontSize = AppSize.fsSm.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            if (showCreator) {
                AvatarView(capsule.creator.avatarId, capsule.creator.nickname, 24.dp)
                Spacer(Modifier.width(AppSize.s2.dp))
                Text(capsule.creator.nickname, color = c.textMuted, fontSize = AppSize.fsSm.sp, maxLines = 1)
            }
            Spacer(Modifier.weight(1f))
            if (rightSlot != null) rightSlot()
            else if (!hideFavorite) FavoriteButton(capsule)
        }
    }
}

@Composable
fun StatusBadge(opened: Boolean) {
    val c = HT.colors
    val (fg, bg, label) = if (opened) {
        Triple(c.capsuleOpenedAccent, c.capsuleOpenedSubtle, "已开启")
    } else {
        Triple(c.capsuleSealedAccent, c.surface2, "未开启")
    }
    Text(
        label,
        color = fg,
        fontSize = AppSize.fsXs.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clip(RoundedCornerShape(AppSize.radiusFull.dp)).background(bg)
            .padding(horizontal = AppSize.s2.dp, vertical = 3.dp),
    )
}

/** 收藏按钮：心形 + 计数；匿名点击弹登录（= 各端 FavoriteButton）。 */
@Composable
fun FavoriteButton(capsule: CapsuleListItem) {
    val c = HT.colors
    val session = AppGraph.session
    val scope = rememberCoroutineScope()
    var active by remember(capsule.id) { mutableStateOf(capsule.favoritedByMe) }
    var count by remember(capsule.id) { mutableStateOf(capsule.favoriteCount) }
    var busy by remember { mutableStateOf(false) }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clip(RoundedCornerShape(AppSize.radiusFull.dp)).clickable(enabled = !busy) {
            if (session.currentUser.value == null && session.refreshTokenValue() == null) {
                session.requireLogin()
                return@clickable
            }
            busy = true
            scope.launch {
                try {
                    if (active) {
                        AppGraph.api.unfavorite(capsule.id)
                        active = false; count = maxOf(0, count - 1)
                    } else {
                        val r = AppGraph.api.favorite(capsule.id)
                        active = true; count = r.favoriteCount
                    }
                } catch (e: Exception) {
                    if (e is ApiException && e.status == 409) { active = true } else session.report(e)
                } finally {
                    busy = false
                }
            }
        }.padding(horizontal = AppSize.s2.dp, vertical = 3.dp),
    ) {
        Icon(
            if (active) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
            contentDescription = "收藏",
            tint = if (active) c.favoriteActive else c.favoriteInactive,
            modifier = Modifier.width(18.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text("$count", color = if (active) c.favoriteActive else c.textMuted, fontSize = AppSize.fsSm.sp)
    }
}
