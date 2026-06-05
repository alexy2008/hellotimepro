package com.hellotimepro.ktor.repository

import com.hellotimepro.ktor.db.Users
import com.hellotimepro.ktor.domain.User
import org.jetbrains.exposed.sql.*
import java.util.UUID

/** 假定调用时已处于一个 Exposed 事务中（由 service 的 dbQuery 开启）。 */
class UserRepository {
    fun findById(id: UUID): User? =
        Users.select { Users.id eq id }.firstOrNull()?.toUser()

    fun findByEmail(email: String): User? =
        Users.select { Users.email eq email }.firstOrNull()?.toUser()

    fun existsByEmail(email: String): Boolean =
        Users.select { Users.email eq email }.count() > 0L

    fun existsByNickname(nickname: String): Boolean =
        Users.select { Users.nickname eq nickname }.count() > 0L

    fun findAllByIds(ids: Collection<UUID>): List<User> =
        if (ids.isEmpty()) emptyList()
        else Users.select { Users.id inList ids }.map { it.toUser() }

    fun insert(user: User) {
        Users.insert {
            it[id] = user.id
            it[email] = user.email
            it[passwordHash] = user.passwordHash
            it[nickname] = user.nickname
            it[avatarId] = user.avatarId
            it[createdAt] = user.createdAt
            it[updatedAt] = user.updatedAt
        }
    }

    fun update(user: User) {
        Users.update({ Users.id eq user.id }) {
            it[email] = user.email
            it[passwordHash] = user.passwordHash
            it[nickname] = user.nickname
            it[avatarId] = user.avatarId
            it[updatedAt] = user.updatedAt
        }
    }
}
