package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.db.dbQuery
import com.hellotimepro.ktor.domain.User
import com.hellotimepro.ktor.dto.UpdateProfileRequest
import com.hellotimepro.ktor.dto.UserDto
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.web.ApiException

class UserService(
    private val users: UserRepository,
    private val avatars: AvatarService,
    private val mapper: MapperService,
) {
    fun toDto(user: User): UserDto = mapper.user(user)

    suspend fun updateProfile(user: User, req: UpdateProfileRequest): UserDto {
        if (req.nickname == null && req.avatarId == null) {
            throw ApiException.validation("至少提供一个字段", "body")
        }
        val newNickname = req.nickname?.let { Validation.nickname(it) }
        val newAvatar = req.avatarId?.let { Validation.avatarFormat(it) }

        return dbQuery {
            var updated = user
            if (newNickname != null && newNickname != user.nickname) {
                if (users.existsByNickname(newNickname)) throw ApiException.conflict("昵称已被使用", "nickname")
                updated = updated.copy(nickname = newNickname)
            }
            if (newAvatar != null) {
                if (!avatars.exists(newAvatar)) throw ApiException.validation("头像 ID 不存在", "avatarId")
                updated = updated.copy(avatarId = newAvatar)
            }
            updated = updated.copy(updatedAt = nowUtc())
            users.update(updated)
            mapper.user(updated)
        }
    }
}
