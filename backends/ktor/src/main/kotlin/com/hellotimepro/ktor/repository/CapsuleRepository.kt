package com.hellotimepro.ktor.repository

import com.hellotimepro.ktor.db.Capsules
import com.hellotimepro.ktor.db.Users
import com.hellotimepro.ktor.db.isSqliteDialect
import com.hellotimepro.ktor.domain.Capsule
import org.jetbrains.exposed.sql.*
import java.time.OffsetDateTime
import java.util.UUID

enum class PlazaSort { HOT, NEW }

class CapsuleRepository {
    fun findById(id: UUID): Capsule? =
        Capsules.select { Capsules.id eq id }.firstOrNull()?.toCapsule()

    /** Postgres 用 SELECT ... FOR UPDATE 序列化并发收藏；SQLite 依赖单写事务。 */
    fun findByIdForUpdate(id: UUID): Capsule? {
        val q = Capsules.select { Capsules.id eq id }
        if (!isSqliteDialect) q.forUpdate()
        return q.firstOrNull()?.toCapsule()
    }

    fun findByCode(code: String): Capsule? =
        Capsules.select { Capsules.code eq code }.firstOrNull()?.toCapsule()

    fun existsByCode(code: String): Boolean =
        Capsules.select { Capsules.code eq code }.count() > 0L

    fun findAllByIds(ids: Collection<UUID>): List<Capsule> =
        if (ids.isEmpty()) emptyList()
        else Capsules.select { Capsules.id inList ids }.map { it.toCapsule() }

    fun insert(capsule: Capsule) {
        Capsules.insert {
            it[id] = capsule.id
            it[ownerId] = capsule.ownerId
            it[code] = capsule.code
            it[title] = capsule.title
            it[content] = capsule.content
            it[openAt] = capsule.openAt
            it[inPlaza] = capsule.inPlaza
            it[favoriteCount] = capsule.favoriteCount
            it[createdAt] = capsule.createdAt
            it[updatedAt] = capsule.updatedAt
        }
    }

    fun deleteById(id: UUID) {
        val cond = Op.build { Capsules.id eq id }
        Capsules.deleteWhere { cond }
    }

    fun incrementFavoriteCount(id: UUID) {
        Capsules.update({ Capsules.id eq id }) {
            with(SqlExpressionBuilder) { it[favoriteCount] = favoriteCount + 1 }
        }
    }

    /** 递减但不为负，对应 spec 不变式（favorite_count >= 0）。 */
    fun decrementFavoriteCount(id: UUID) {
        Capsules.update({ (Capsules.id eq id) and (Capsules.favoriteCount greater 0) }) {
            with(SqlExpressionBuilder) { it[favoriteCount] = favoriteCount - 1 }
        }
    }

    fun findByOwnerPaged(ownerId: UUID, offset: Long, limit: Int): List<Capsule> =
        Capsules.select { Capsules.ownerId eq ownerId }
            .orderBy(Capsules.createdAt to SortOrder.DESC)
            .limit(limit, offset)
            .map { it.toCapsule() }

    fun countByOwner(ownerId: UUID): Long =
        Capsules.select { Capsules.ownerId eq ownerId }.count()

    fun findPlazaPaged(
        filter: String,
        now: OffsetDateTime,
        qPattern: String?,
        sort: PlazaSort,
        offset: Long,
        limit: Int,
    ): List<Capsule> {
        val order = when (sort) {
            PlazaSort.HOT -> arrayOf(
                Capsules.favoriteCount to SortOrder.DESC,
                Capsules.createdAt to SortOrder.DESC,
            )
            PlazaSort.NEW -> arrayOf(Capsules.createdAt to SortOrder.DESC)
        }
        return Capsules.select { plazaCondition(filter, now, qPattern) }
            .orderBy(*order)
            .limit(limit, offset)
            .map { it.toCapsule() }
    }

    fun countPlaza(filter: String, now: OffsetDateTime, qPattern: String?): Long =
        Capsules.select { plazaCondition(filter, now, qPattern) }.count()

    private fun SqlExpressionBuilder.plazaCondition(
        filter: String,
        now: OffsetDateTime,
        qPattern: String?,
    ): Op<Boolean> {
        var cond: Op<Boolean> = Capsules.inPlaza eq true
        when (filter) {
            "opened" -> cond = cond and (Capsules.openAt lessEq now)
            "unopened" -> cond = cond and (Capsules.openAt greater now)
        }
        if (qPattern != null) {
            val titleMatch = Capsules.title.lowerCase() like qPattern
            val nickMatch = exists(
                Users.select {
                    (Users.id eq Capsules.ownerId) and (Users.nickname.lowerCase() like qPattern)
                },
            )
            cond = cond and (titleMatch or nickMatch)
        }
        return cond
    }
}
