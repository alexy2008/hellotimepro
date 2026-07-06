// 日期工具：ISO 解析 / 本地显示 / 距开启文案 / 倒计时拆解。
// = desktop/swiftui DateUtil / flutter utils/format.dart（java.time，minSdk 26+）。
package pro.hellotime.android.util

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object DateUtil {
    private val display = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

    fun parse(iso: String): Instant =
        runCatching { Instant.parse(iso) }
            .getOrElse { runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrElse { Instant.EPOCH } }

    fun display(iso: String): String =
        LocalDateTime.ofInstant(parse(iso), ZoneId.systemDefault()).format(display)

    fun isoFrom(local: LocalDateTime): String =
        DateTimeFormatter.ISO_INSTANT.format(local.atZone(ZoneId.systemDefault()).toInstant())

    /** 距开启文案（= 各端 _distance）。 */
    fun distance(iso: String, now: Instant = Instant.now()): String {
        val diffMin = Math.ceil((parse(iso).toEpochMilli() - now.toEpochMilli()) / 60000.0).toLong()
        if (diffMin <= 0) return "已到开启时刻"
        if (diffMin < 60) return "距开启 $diffMin 分钟"
        val hours = diffMin / 60
        val minutes = diffMin % 60
        if (hours < 24) return "距开启 $hours 小时${if (minutes != 0L) " $minutes 分钟" else ""}"
        val days = hours / 24
        val restHours = hours % 24
        if (days < 365) return "距开启 $days 天${if (restHours != 0L) " $restHours 小时" else ""}"
        val years = days / 365
        val restDays = days % 365
        return "距开启 $years 年${if (restDays != 0L) " $restDays 天" else ""}"
    }

    /** 倒计时拆解（天/时/分/秒），已到点返回 null。 */
    fun countdown(iso: String, now: Instant = Instant.now()): List<Pair<Long, String>>? {
        var secs = (parse(iso).epochSecond - now.epochSecond)
        if (secs <= 0) return null
        val d = secs / 86400; secs %= 86400
        val h = secs / 3600; secs %= 3600
        val m = secs / 60
        val s = secs % 60
        return listOf(d to "天", h to "时", m to "分", s to "秒")
    }
}
