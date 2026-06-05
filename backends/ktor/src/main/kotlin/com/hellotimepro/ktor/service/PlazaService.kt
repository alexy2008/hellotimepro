package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.CapsuleListItem
import com.hellotimepro.ktor.dto.Paginated
import com.hellotimepro.ktor.dto.Pagination
import com.hellotimepro.ktor.repository.CapsuleRepository
import com.hellotimepro.ktor.repository.FavoriteRepository
import com.hellotimepro.ktor.repository.PlazaSort
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.web.ApiException
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
        var normalized = q?.trim()?.lowercase()
        if (normalized != null && normalized.isEmpty()) normalized = null
        if (normalized != null && normalized.length > 50) throw ApiException.validation("q 长度不得超过 50", "q")
        val qPattern = normalized?.let { "%$it%" }
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

    suspend fun myCapsules(user: User, page: Int, pageSize: Int): Paginated<CapsuleListItem> {
        Validation.page(page, pageSize)
        return dbQuery {
            val total = capsules.countByOwner(user.id)
            val rows = capsules.findByOwnerPaged(user.id, offset(page, pageSize), pageSize)
            val items = rows.map { mapper.listItem(it, user, favoritedByMe = false, favoritedAt = null) }
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
