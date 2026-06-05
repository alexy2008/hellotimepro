package com.hellotimepro.ktor.domain

import java.time.OffsetDateTime
import java.util.UUID

/** 领域模型：与数据库行一一对应的不可变数据类（presentation/DTO 层之外的内部表示）。 */

data class User(
    val id: UUID,
    val email: String,
    val passwordHash: String,
    val nickname: String,
    val avatarId: String,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

data class Capsule(
    val id: UUID,
    val ownerId: UUID,
    val code: String,
    val title: String,
    val content: String,
    val openAt: OffsetDateTime,
    val inPlaza: Boolean,
    val favoriteCount: Int,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

data class Favorite(
    val userId: UUID,
    val capsuleId: UUID,
    val createdAt: OffsetDateTime,
)

data class RefreshToken(
    val id: UUID,
    val userId: UUID,
    val tokenHash: String,
    val familyId: UUID,
    val expiresAt: OffsetDateTime,
    val createdAt: OffsetDateTime,
    val revokedAt: OffsetDateTime?,
)
