package com.hellotimepro.ktor.service

import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

internal fun nowUtc(): OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC)

/** 序列化为 ISO-8601 UTC（`...Z`）。 */
internal fun isoInstant(value: OffsetDateTime): String = value.toInstant().toString()

/** 宽松解析 UUID：非法格式返回 null（调用方据此转 404 而非 500）。 */
internal fun parseUuidOrNull(value: String): UUID? = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    null
}
