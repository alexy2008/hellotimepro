package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.Favorite
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.FavoriteResult
import com.hellotimepro.ktor.repository.CapsuleRepository
import com.hellotimepro.ktor.repository.FavoriteRepository
import com.hellotimepro.ktor.web.ApiException

class FavoriteService(
    private val capsules: CapsuleRepository,
    private val favorites: FavoriteRepository,
) {
    suspend fun addFavorite(user: User, capsuleIdRaw: String?): FavoriteResult {
        val capsuleId = capsuleIdRaw?.let { parseUuidOrNull(it) } ?: throw ApiException.notFound("胶囊不存在")
        return dbQuery {
            // favorite_count 是冗余计数器，必须和 favorites 行变更同处一个事务。
            // Postgres 路径取胶囊行写锁；SQLite 依赖单写事务和原子 UPDATE。
            val capsule = capsules.findByIdForUpdate(capsuleId) ?: throw ApiException.notFound("胶囊不存在")
            if (!capsule.inPlaza) throw ApiException.notFound("胶囊不存在")
            if (capsule.ownerId == user.id) throw ApiException.badRequest("不能收藏自己创建的胶囊")

            val existing = favorites.find(user.id, capsule.id)
            if (existing != null) {
                return@dbQuery FavoriteResult(capsule.id.toString(), capsule.favoriteCount, isoInstant(existing.createdAt))
            }
            val now = nowUtc()
            favorites.insert(Favorite(user.id, capsule.id, now))
            capsules.incrementFavoriteCount(capsule.id)
            val newCount = capsules.findById(capsule.id)?.favoriteCount ?: (capsule.favoriteCount + 1)
            FavoriteResult(capsule.id.toString(), newCount, isoInstant(now))
        }
    }

    suspend fun removeFavorite(user: User, capsuleIdRaw: String) {
        // 取消收藏幂等：胶囊不存在/格式非法/原本未收藏都返回成功（204）。
        val capsuleId = parseUuidOrNull(capsuleIdRaw) ?: return
        dbQuery {
            val capsule = capsules.findById(capsuleId) ?: return@dbQuery
            if (favorites.exists(user.id, capsule.id)) {
                favorites.delete(user.id, capsule.id)
                capsules.decrementFavoriteCount(capsule.id)
            }
        }
    }
}
