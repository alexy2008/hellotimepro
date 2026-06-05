package com.hellotimepro.ktor.repository

import com.hellotimepro.ktor.db.Capsules
import com.hellotimepro.ktor.db.Favorites
import com.hellotimepro.ktor.db.RefreshTokens
import com.hellotimepro.ktor.db.Users
import com.hellotimepro.ktor.domain.Capsule
import com.hellotimepro.ktor.domain.Favorite
import com.hellotimepro.ktor.domain.RefreshToken
import com.hellotimepro.ktor.domain.User
import org.jetbrains.exposed.sql.ResultRow

fun ResultRow.toUser() = User(
    id = this[Users.id],
    email = this[Users.email],
    passwordHash = this[Users.passwordHash],
    nickname = this[Users.nickname],
    avatarId = this[Users.avatarId],
    createdAt = this[Users.createdAt],
    updatedAt = this[Users.updatedAt],
)

fun ResultRow.toCapsule() = Capsule(
    id = this[Capsules.id],
    ownerId = this[Capsules.ownerId],
    code = this[Capsules.code],
    title = this[Capsules.title],
    content = this[Capsules.content],
    openAt = this[Capsules.openAt],
    inPlaza = this[Capsules.inPlaza],
    favoriteCount = this[Capsules.favoriteCount],
    createdAt = this[Capsules.createdAt],
    updatedAt = this[Capsules.updatedAt],
)

fun ResultRow.toFavorite() = Favorite(
    userId = this[Favorites.userId],
    capsuleId = this[Favorites.capsuleId],
    createdAt = this[Favorites.createdAt],
)

fun ResultRow.toRefreshToken() = RefreshToken(
    id = this[RefreshTokens.id],
    userId = this[RefreshTokens.userId],
    tokenHash = this[RefreshTokens.tokenHash],
    familyId = this[RefreshTokens.familyId],
    expiresAt = this[RefreshTokens.expiresAt],
    createdAt = this[RefreshTokens.createdAt],
    revokedAt = this[RefreshTokens.revokedAt],
)
