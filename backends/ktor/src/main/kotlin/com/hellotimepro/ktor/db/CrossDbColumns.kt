package com.hellotimepro.ktor.db

import org.jetbrains.exposed.sql.ColumnType
import org.jetbrains.exposed.sql.vendors.SQLiteDialect
import org.jetbrains.exposed.sql.vendors.currentDialect
import java.sql.Timestamp
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoField
import java.util.UUID

/**
 * 跨库列类型：在同一套 Exposed 表定义上，运行时按方言分流读写格式。
 * 这是 Ktor/Exposed 版对 Spring `CrossDbUuidJdbcType` / `CrossDbOffsetDateTimeJdbcType` 的等价实现。
 *
 * - **SQLite**：spec schema 下 id 存 32 位无横线 hex TEXT，时间戳存 ISO-8601 TEXT（UTC、`+00:00`）。
 *   sqlite-jdbc 无法把 TEXT 解析成原生时间类型，故直接以字符串读写；写出格式与 seed 完全一致，
 *   保证按字符串比较的 `open_at <= :now`、`ORDER BY created_at` 正确。
 * - **Postgres**：原生 `uuid` / `timestamptz`，用 `UUID` / `OffsetDateTime` 直传。
 */
internal val isSqliteDialect: Boolean get() = currentDialect is SQLiteDialect

/** UUID 列：SQLite → 32 位 hex TEXT；Postgres → 原生 uuid。读时兼容带/不带横线。 */
class CrossUuidColumnType : ColumnType() {
    override fun sqlType(): String = if (isSqliteDialect) "TEXT" else "uuid"

    override fun valueFromDB(value: Any): Any = when (value) {
        is UUID -> value
        is String -> fromHex(value)
        else -> fromHex(value.toString())
    }

    override fun notNullValueToDB(value: Any): Any {
        val u = value as? UUID ?: fromHex(value.toString())
        return if (isSqliteDialect) toHex(u) else u
    }

    override fun nonNullValueToString(value: Any): String {
        val u = value as? UUID ?: fromHex(value.toString())
        return if (isSqliteDialect) "'${toHex(u)}'" else "'$u'"
    }

    private fun toHex(u: UUID): String = u.toString().replace("-", "")

    private fun fromHex(raw: String): UUID {
        val s = raw.trim()
        return if (s.length == 32) {
            UUID.fromString(
                "${s.substring(0, 8)}-${s.substring(8, 12)}-${s.substring(12, 16)}-" +
                    "${s.substring(16, 20)}-${s.substring(20)}",
            )
        } else {
            UUID.fromString(s)
        }
    }
}

/** 时间戳列：SQLite → ISO-8601 TEXT（与 seed 对齐）；Postgres → 原生 timestamptz。 */
class CrossTimestampColumnType : ColumnType() {
    override fun sqlType(): String = if (isSqliteDialect) "TEXT" else "TIMESTAMP WITH TIME ZONE"

    override fun valueFromDB(value: Any): Any = when (value) {
        is OffsetDateTime -> value.withOffsetSameInstant(ZoneOffset.UTC)
        is Timestamp -> value.toInstant().atOffset(ZoneOffset.UTC)
        is Instant -> value.atOffset(ZoneOffset.UTC)
        is LocalDateTime -> value.atOffset(ZoneOffset.UTC)
        is String -> fromIso(value)
        else -> fromIso(value.toString())
    }

    override fun notNullValueToDB(value: Any): Any {
        val odt = (value as OffsetDateTime).withOffsetSameInstant(ZoneOffset.UTC)
        return if (isSqliteDialect) odt.format(WRITE) else odt
    }

    override fun nonNullValueToString(value: Any): String {
        val odt = (value as OffsetDateTime).withOffsetSameInstant(ZoneOffset.UTC)
        return "'${odt.format(WRITE)}'"
    }

    companion object {
        // 与 seed 对齐：输出秒、可选小数秒，零偏移渲染成 +00:00（而非 ISO 默认的 Z）。
        private val WRITE: DateTimeFormatter = DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
            .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd()
            .appendOffset("+HH:MM", "+00:00")
            .toFormatter()

        private fun fromIso(raw: String): OffsetDateTime {
            var s = raw.trim()
            // 容错：旧数据可能用空格分隔（'2026-06-01 10:00:00...'）。
            if (s.length > 10 && s[10] == ' ') {
                s = s.substring(0, 10) + 'T' + s.substring(11)
            }
            return try {
                OffsetDateTime.parse(s, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            } catch (_: DateTimeParseException) {
                LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME).atOffset(ZoneOffset.UTC)
            }
        }
    }
}
