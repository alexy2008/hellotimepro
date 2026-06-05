package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.domain.Capsule
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.CapsuleDetail
import com.hellotimepro.ktor.dto.CapsuleListItem
import com.hellotimepro.ktor.dto.UserBrief
import com.hellotimepro.ktor.dto.UserDto
import java.time.OffsetDateTime
import java.time.ZoneOffset

/** 领域模型 → 响应 DTO。时间统一序列化为 ISO-8601 UTC（`...Z`）。 */
class MapperService {
    fun user(u: User): UserDto =
        UserDto(u.id.toString(), u.email, u.nickname, u.avatarId, iso(u.createdAt))

    fun detail(c: Capsule, owner: User, favoritedByMe: Boolean, includeContent: Boolean = true): CapsuleDetail {
        val opened = isOpened(c.openAt)
        return CapsuleDetail(
            id = c.id.toString(),
            code = c.code,
            title = c.title,
            creator = UserBrief(owner.nickname, owner.avatarId),
            openAt = iso(c.openAt),
            createdAt = iso(c.createdAt),
            inPlaza = c.inPlaza,
            favoriteCount = c.favoriteCount,
            isOpened = opened,
            content = if (opened && includeContent) c.content else null,
            favoritedByMe = favoritedByMe,
        )
    }

    fun listItem(c: Capsule, owner: User, favoritedByMe: Boolean, favoritedAt: OffsetDateTime?): CapsuleListItem {
        val opened = isOpened(c.openAt)
        val preview = if (opened) {
            val raw = c.content.trim()
            if (raw.length > 80) raw.substring(0, 80) + "…" else raw
        } else {
            null
        }
        return CapsuleListItem(
            id = c.id.toString(),
            code = c.code,
            title = c.title,
            creator = UserBrief(owner.nickname, owner.avatarId),
            openAt = iso(c.openAt),
            createdAt = iso(c.createdAt),
            inPlaza = c.inPlaza,
            favoriteCount = c.favoriteCount,
            isOpened = opened,
            favoritedByMe = favoritedByMe,
            favoritedAt = favoritedAt?.let { iso(it) },
            contentPreview = preview,
        )
    }

    private fun isOpened(openAt: OffsetDateTime): Boolean =
        !openAt.isAfter(OffsetDateTime.now(ZoneOffset.UTC))

    private fun iso(value: OffsetDateTime): String = value.toInstant().toString()
}
