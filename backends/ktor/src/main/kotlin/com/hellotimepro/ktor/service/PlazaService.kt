package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.CapsuleListItem
import com.hellotimepro.ktor.dto.MyStats
import com.hellotimepro.ktor.dto.Paginated
import com.hellotimepro.ktor.dto.Pagination
import com.hellotimepro.ktor.dto.PlazaCounts
import com.hellotimepro.ktor.dto.PlazaStats
import com.hellotimepro.ktor.repository.CapsuleRepository
import com.hellotimepro.ktor.repository.FavoriteRepository
import com.hellotimepro.ktor.repository.PlazaSort
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.web.ApiException
import org.jetbrains.exposed.sql.LikePattern
import java.util.UUID
import kotlin.math.ceil

class PlazaService(
    private val capsules: CapsuleRepository,
    private val users: UserRepository,
    private val favorites: FavoriteRepository,
    private val mapper: MapperService,
) {
    suspend fun plazaList(
        sort: String,
        filter: String,
        q: String?,
        page: Int,
        pageSize: Int,
        viewerId: UUID?,
    ): Paginated<CapsuleListItem> {
        Validation.page(page, pageSize)
        if (sort != "hot" && sort != "new") throw ApiException.validation("sort 仅支持 hot/new", "sort")
        if (filter != "all" && filter != "opened" && filter != "unopened") {
            throw ApiException.validation("filter 仅支持 all/opened/unopened", "filter")
        }
        val qPattern = searchPattern(q)
        val sortEnum = if (sort == "hot") PlazaSort.HOT else PlazaSort.NEW
        val now = nowUtc()

        return dbQuery {
            val total = capsules.countPlaza(filter, now, qPattern)
            val rows = capsules.findPlazaPaged(filter, now, qPattern, sortEnum, offset(page, pageSize), pageSize)
            val owners = users.findAllByIds(rows.map { it.ownerId }).associateBy { it.id }
            val faved = loadFavoriteSet(viewerId, rows.map { it.id })
            val items = rows.mapNotNull { c ->
                owners[c.ownerId]?.let { mapper.listItem(c, it, c.id in faved, null) }
            }
            Paginated(items, pagination(total, page, pageSize))
        }
    }

    suspend fun plazaStats(q: String?): PlazaStats {
        val qPattern = searchPattern(q)
        val now = nowUtc()
        return dbQuery {
            val counts = capsules.plazaCounts(now, qPattern)
            PlazaStats(
                PlazaCounts(counts.all, counts.opened, counts.unopened),
                capsules.farthestOpenAt()?.let(::isoInstant),
                capsules.nextOpenAt(now)?.let(::isoInstant),
            )
        }
    }

    suspend fun myStats(user: User): MyStats = dbQuery {
        val counts = capsules.ownedCounts(user.id, nowUtc())
        MyStats(
            counts.created, counts.opened, counts.unopened, counts.inPlaza, counts.favoritesReceived,
            favorites.countByUser(user.id),
        )
    }

    suspend fun myCapsules(user: User, page: Int, pageSize: Int): Paginated<CapsuleListItem> {
        Validation.page(page, pageSize)
        return dbQuery {
            val total = capsules.countByOwner(user.id)
            val rows = capsules.findByOwnerPaged(user.id, offset(page, pageSize), pageSize)
            val faved = loadFavoriteSet(user.id, rows.map { it.id })
            val items = rows.map { mapper.listItem(it, user, favoritedByMe = it.id in faved, favoritedAt = null) }
            Paginated(items, pagination(total, page, pageSize))
        }
    }

    suspend fun myFavorites(user: User, page: Int, pageSize: Int): Paginated<CapsuleListItem> {
        Validation.page(page, pageSize)
        return dbQuery {
            val total = favorites.countByUser(user.id)
            val favs = favorites.findByUserPaged(user.id, offset(page, pageSize), pageSize)
            if (favs.isEmpty()) {
                return@dbQuery Paginated(emptyList(), pagination(total, page, pageSize))
            }
            val capsuleMap = capsules.findAllByIds(favs.map { it.capsuleId }).associateBy { it.id }
            val owners = users.findAllByIds(capsuleMap.values.map { it.ownerId }).associateBy { it.id }
            val items = favs.mapNotNull { f ->
                val c = capsuleMap[f.capsuleId] ?: return@mapNotNull null
                owners[c.ownerId]?.let { mapper.listItem(c, it, favoritedByMe = true, favoritedAt = f.createdAt) }
            }
            Paginated(items, pagination(total, page, pageSize))
        }
    }

    private fun searchPattern(value: String?): LikePattern? {
        val trimmed = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        if (trimmed.codePointCount(0, trimmed.length) > 50) {
            throw ApiException.validation("q 长度不得超过 50", "q")
        }
        val literal = trimmed.lowercase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        return LikePattern("%$literal%", '\\')
    }

    private fun loadFavoriteSet(viewerId: UUID?, capsuleIds: List<UUID>): Set<UUID> {
        if (viewerId == null || capsuleIds.isEmpty()) return emptySet()
        return favorites.findByUserAndCapsuleIds(viewerId, capsuleIds).map { it.capsuleId }.toSet()
    }

    private fun offset(page: Int, pageSize: Int): Long = (page - 1).toLong() * pageSize

    private fun pagination(total: Long, page: Int, pageSize: Int): Pagination {
        val totalPages = if (pageSize == 0) 0 else ceil(total.toDouble() / pageSize).toInt()
        return Pagination(page, pageSize, total, totalPages)
    }
}
