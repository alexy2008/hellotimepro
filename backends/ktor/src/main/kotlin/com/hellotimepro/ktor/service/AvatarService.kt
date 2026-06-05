package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.dto.AvatarDto
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** 从 spec/avatars/catalog.json 加载内置头像目录（启动时一次）。 */
class AvatarService(config: AppConfig) {
    private val avatars: List<AvatarDto>
    private val ids: Set<String>

    init {
        val file = File(config.repoRoot).absoluteFile.normalize()
            .resolve("spec/avatars/catalog.json")
        val parsed = Json { ignoreUnknownKeys = true }
            .decodeFromString<Catalog>(file.readText())
        avatars = parsed.avatars
        ids = avatars.map { it.id }.toSet()
    }

    fun list(): List<AvatarDto> = avatars

    fun exists(id: String): Boolean = id in ids

    @Serializable
    private data class Catalog(val avatars: List<AvatarDto>)
}
