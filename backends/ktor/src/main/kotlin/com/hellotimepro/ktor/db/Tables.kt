package com.hellotimepro.ktor.db

import org.jetbrains.exposed.sql.Column
import org.jetbrains.exposed.sql.Table
import java.time.OffsetDateTime
import java.util.UUID

/**
 * Exposed 表定义，结构对齐 spec/db/schema.sql。
 * 表/索引由 `scripts/db` 维护，这里只用于查询，不做 DDL（不调用 SchemaUtils.create）。
 *
 * 自定义跨库列通过 protected `registerColumn`（只能在 Table 子类内调用）注册。
 */
object Users : Table("users") {
    val id: Column<UUID> = registerColumn("id", CrossUuidColumnType())
    val email = varchar("email", 254)
    val passwordHash = varchar("password_hash", 100)
    val nickname = varchar("nickname", 20)
    val avatarId = varchar("avatar_id", 20)
    val createdAt: Column<OffsetDateTime> = registerColumn("created_at", CrossTimestampColumnType())
    val updatedAt: Column<OffsetDateTime> = registerColumn("updated_at", CrossTimestampColumnType())
    override val primaryKey = PrimaryKey(id)
}

object Capsules : Table("capsules") {
    val id: Column<UUID> = registerColumn("id", CrossUuidColumnType())
    val ownerId: Column<UUID> = registerColumn("owner_id", CrossUuidColumnType())
    val code = varchar("code", 8)
    val title = varchar("title", 60)
    val content = text("content")
    val openAt: Column<OffsetDateTime> = registerColumn("open_at", CrossTimestampColumnType())
    val inPlaza = bool("in_plaza")
    val favoriteCount = integer("favorite_count")
    val createdAt: Column<OffsetDateTime> = registerColumn("created_at", CrossTimestampColumnType())
    val updatedAt: Column<OffsetDateTime> = registerColumn("updated_at", CrossTimestampColumnType())
    override val primaryKey = PrimaryKey(id)
}

object Favorites : Table("favorites") {
    val userId: Column<UUID> = registerColumn("user_id", CrossUuidColumnType())
    val capsuleId: Column<UUID> = registerColumn("capsule_id", CrossUuidColumnType())
    val createdAt: Column<OffsetDateTime> = registerColumn("created_at", CrossTimestampColumnType())
    override val primaryKey = PrimaryKey(userId, capsuleId)
}

object RefreshTokens : Table("refresh_tokens") {
    val id: Column<UUID> = registerColumn("id", CrossUuidColumnType())
    val userId: Column<UUID> = registerColumn("user_id", CrossUuidColumnType())
    val tokenHash = varchar("token_hash", 100)
    val familyId: Column<UUID> = registerColumn("family_id", CrossUuidColumnType())
    val expiresAt: Column<OffsetDateTime> = registerColumn("expires_at", CrossTimestampColumnType())
    val createdAt: Column<OffsetDateTime> = registerColumn("created_at", CrossTimestampColumnType())
    val revokedAt: Column<OffsetDateTime?> =
        registerColumn<OffsetDateTime>("revoked_at", CrossTimestampColumnType()).nullable()
    override val primaryKey = PrimaryKey(id)
}
