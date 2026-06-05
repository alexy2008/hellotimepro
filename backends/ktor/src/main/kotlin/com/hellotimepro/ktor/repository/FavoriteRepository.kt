package com.hellotimepro.ktor.repository

import com.hellotimepro.ktor.db.Favorites
import com.hellotimepro.ktor.domain.Favorite
import org.jetbrains.exposed.sql.*
import java.util.UUID

class FavoriteRepository {
    fun find(userId: UUID, capsuleId: UUID): Favorite? =
        Favorites.select { (Favorites.userId eq userId) and (Favorites.capsuleId eq capsuleId) }
            .firstOrNull()?.toFavorite()

    fun exists(userId: UUID, capsuleId: UUID): Boolean =
        Favorites.select { (Favorites.userId eq userId) and (Favorites.capsuleId eq capsuleId) }
            .count() > 0L

    fun insert(favorite: Favorite) {
        Favorites.insert {
            it[userId] = favorite.userId
            it[capsuleId] = favorite.capsuleId
            it[createdAt] = favorite.createdAt
        }
    }

    fun delete(userId: UUID, capsuleId: UUID) {
        val cond = Op.build { (Favorites.userId eq userId) and (Favorites.capsuleId eq capsuleId) }
        Favorites.deleteWhere { cond }
    }

    fun deleteByCapsule(capsuleId: UUID) {
        val cond = Op.build { Favorites.capsuleId eq capsuleId }
        Favorites.deleteWhere { cond }
    }

    fun findByUserPaged(userId: UUID, offset: Long, limit: Int): List<Favorite> =
        Favorites.select { Favorites.userId eq userId }
            .orderBy(Favorites.createdAt to SortOrder.DESC)
            .limit(limit, offset)
            .map { it.toFavorite() }

    fun countByUser(userId: UUID): Long =
        Favorites.select { Favorites.userId eq userId }.count()

    fun findByUserAndCapsuleIds(userId: UUID, capsuleIds: Collection<UUID>): List<Favorite> =
        if (capsuleIds.isEmpty()) emptyList()
        else Favorites.select { (Favorites.userId eq userId) and (Favorites.capsuleId inList capsuleIds) }
            .map { it.toFavorite() }
}
