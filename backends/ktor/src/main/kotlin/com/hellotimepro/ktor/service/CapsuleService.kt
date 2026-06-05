package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.Capsule
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.CapsuleDetail
import com.hellotimepro.ktor.dto.CreateCapsuleRequest
import com.hellotimepro.ktor.repository.CapsuleRepository
import com.hellotimepro.ktor.repository.FavoriteRepository
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.web.ApiException
import java.security.SecureRandom
import java.time.ZoneOffset
import java.util.UUID

class CapsuleService(
    private val capsules: CapsuleRepository,
    private val users: UserRepository,
    private val favorites: FavoriteRepository,
    private val mapper: MapperService,
) {
    private val random = SecureRandom()

    suspend fun create(owner: User, req: CreateCapsuleRequest): CapsuleDetail {
        val title = Validation.title(req.title)
        val content = Validation.content(req.content)
        val openAt = Validation.openAt(req.openAt).withOffsetSameInstant(ZoneOffset.UTC)
        val now = nowUtc()
        if (openAt.isBefore(now.plusSeconds(60))) {
            throw ApiException.validation("openAt 必须晚于当前时间 60 秒以上", "openAt")
        }
        if (openAt.isAfter(now.plusYears(10))) {
            throw ApiException.validation("openAt 不得超出当前时间 10 年", "openAt")
        }
        val inPlaza = req.inPlaza ?: true

        return dbQuery {
            val code = run {
                repeat(5) {
                    val candidate = generateCode()
                    if (!capsules.existsByCode(candidate)) return@run candidate
                }
                throw IllegalStateException("生成唯一码失败")
            }
            val capsule = Capsule(
                id = UUID.randomUUID(),
                ownerId = owner.id,
                code = code,
                title = title,
                content = content,
                openAt = openAt,
                inPlaza = inPlaza,
                favoriteCount = 0,
                createdAt = now,
                updatedAt = now,
            )
            capsules.insert(capsule)
            mapper.detail(capsule, owner, favoritedByMe = false, includeContent = true)
        }
    }

    suspend fun getByCode(code: String, viewerId: UUID?): CapsuleDetail {
        Validation.code(code)
        return dbQuery {
            val capsule = capsules.findByCode(code.uppercase()) ?: throw ApiException.notFound("胶囊不存在")
            val owner = users.findById(capsule.ownerId) ?: throw ApiException.notFound("胶囊不存在")
            val favorited = viewerId != null && favorites.exists(viewerId, capsule.id)
            mapper.detail(capsule, owner, favorited, includeContent = true)
        }
    }

    suspend fun getPlazaDetail(idRaw: String, viewerId: UUID?): CapsuleDetail {
        val id = parseUuidOrNull(idRaw) ?: throw ApiException.notFound("胶囊不存在")
        return dbQuery {
            val capsule = capsules.findById(id)?.takeIf { it.inPlaza } ?: throw ApiException.notFound("胶囊不存在")
            val owner = users.findById(capsule.ownerId) ?: throw ApiException.notFound("胶囊不存在")
            val favorited = viewerId != null && favorites.exists(viewerId, capsule.id)
            mapper.detail(capsule, owner, favorited, includeContent = true)
        }
    }

    suspend fun deleteOwn(user: User, idRaw: String) {
        val id = parseUuidOrNull(idRaw) ?: throw ApiException.notFound("胶囊不存在")
        dbQuery {
            val capsule = capsules.findById(id) ?: throw ApiException.notFound("胶囊不存在")
            if (capsule.ownerId != user.id) throw ApiException.forbidden("无权删除他人胶囊")
            favorites.deleteByCapsule(id)
            capsules.deleteById(id)
        }
    }

    private fun generateCode(): String =
        (1..8).map { CODE_ALPHABET[random.nextInt(CODE_ALPHABET.size)] }.joinToString("")

    companion object {
        private val CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray()
    }
}
