package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.dto.CapsuleSuggestion
import com.hellotimepro.ktor.dto.CapsuleSuggestionRequest
import com.hellotimepro.ktor.web.ApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.random.Random

/** 由标题生成胶囊正文与开启天数建议。LLM 不可用时本地兜底（generatedBy=local-template）。 */
class CapsuleSuggestionService(private val config: AppConfig, private val llm: LlmClient) {
    private val log = LoggerFactory.getLogger(CapsuleSuggestionService::class.java)
    private val promptTemplate: String = loadTemplate(config, "spec/llm/capsule-suggestion.prompt.md")

    suspend fun suggest(req: CapsuleSuggestionRequest): CapsuleSuggestion {
        if (req.title != null && req.title.length > 60) {
            throw ApiException.validation("标题长度不得超过 60", "title")
        }
        val title = req.title?.trim().orEmpty()
        val autoTitle = title.isEmpty()

        var generatedBy = "local-template"
        var resultTitle: String? = null
        var content: String? = null
        var days = 0
        var ok = false

        try {
            val node = withContext(Dispatchers.IO) { llm.generateCapsuleSuggestion(buildPrompt(title)) }
            var rawContent = node["content"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
            if (rawContent.length > 5000) rawContent = rawContent.substring(0, 5000)
            if (rawContent.isBlank()) throw IllegalArgumentException("LLM returned empty content")
            val rawDays = coerceOpenInDays(node["openInDays"])
            var genTitle: String? = null
            if (autoTitle) {
                genTitle = truncateTitle(node["title"]?.jsonPrimitive?.contentOrNull)
                if (genTitle.isBlank()) throw IllegalArgumentException("LLM returned empty title in auto-title mode")
            }
            content = rawContent
            days = rawDays
            if (autoTitle) resultTitle = genTitle
            generatedBy = "${config.llm.provider}:${config.llm.model}"
            ok = true
        } catch (e: LlmClient.LlmClientException) {
            log.warn("Capsule suggestion LLM failed; using local fallback: {}", e.message)
        } catch (e: IllegalArgumentException) {
            log.warn("Capsule suggestion LLM failed; using local fallback: {}", e.message)
        }

        if (!ok) {
            val fb = fallback(autoTitle, title)
            resultTitle = if (autoTitle) fb.title else null
            content = fb.content
            days = fb.days
        }

        val openAt = nowUtc().plusDays(days.toLong())
        return CapsuleSuggestion(resultTitle, content!!, days, isoInstant(openAt), generatedBy, false)
    }

    private fun buildPrompt(title: String): String {
        val template = promptTemplate.ifBlank { DEFAULT_PROMPT_TEMPLATE }
        return template.replace("{TITLE_OR_EMPTY}", title).replace("{TITLE}", title)
    }

    private fun truncateTitle(raw: String?): String {
        var cleaned = (raw ?: "").trim().replace(Regex("[\\r\\n]+"), " ")
        cleaned = cleaned.replace(Regex("^[#*`　 \"'《》【】]+"), "").replace(Regex("[#*`　 \"'《》【】]+$"), "").trim()
        if (cleaned.length > 60) cleaned = cleaned.substring(0, 60)
        return cleaned
    }

    private fun coerceOpenInDays(value: JsonElement?): Int {
        if (value == null || value is kotlinx.serialization.json.JsonNull) {
            throw IllegalArgumentException("openInDays missing")
        }
        val prim = value as? JsonPrimitive ?: throw IllegalArgumentException("openInDays not a number")
        val days = prim.intOrNull
            ?: prim.contentOrNull?.toDoubleOrNull()?.toInt()
            ?: throw IllegalArgumentException("openInDays not a number")
        return days.coerceIn(1, 3650)
    }

    private data class Fallback(val title: String, val content: String, val days: Int)

    private fun fallback(autoTitle: Boolean, title: String): Fallback {
        if (autoTitle) return FALLBACK_CAPSULES[Random.nextInt(FALLBACK_CAPSULES.size)]
        val days = FALLBACK_DAYS[Random.nextInt(FALLBACK_DAYS.size)]
        val content = "写下《$title》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。" +
            "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n" +
            "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、" +
            "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n" +
            "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。"
        return Fallback(title, content, days)
    }

    companion object {
        private val FALLBACK_DAYS = listOf(30, 90, 180, 365)
        private val DEFAULT_PROMPT_TEMPLATE =
            "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。" +
                "为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。" +
                "只返回严格 JSON：{\"title\":\"...\",\"content\":\"...\",\"openInDays\":30}。"

        private val FALLBACK_CAPSULES = listOf(
            Fallback(
                "写给一个月后的自己",
                "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，" +
                    "有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n" +
                    "如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，" +
                    "你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。",
                30,
            ),
            Fallback(
                "下个季度想完成的一件事",
                "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。" +
                    "现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n" +
                    "等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。" +
                    "无论结果如何，请记得为当初愿意开始的自己鼓一次掌。",
                90,
            ),
            Fallback(
                "猜猜下届世界杯冠军是谁",
                "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。" +
                    "此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n" +
                    "等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，" +
                    "希望那段为热爱呐喊的日子，依然让你觉得值得。",
                365,
            ),
            Fallback(
                "明年生日想对自己说的话",
                "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成" +
                    "自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n" +
                    "请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。",
                365,
            ),
            Fallback(
                "三年后还在做喜欢的事吗",
                "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。" +
                    "此刻它带给我很多快乐，也带来一些迷茫。\n\n" +
                    "如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。" +
                    "无论如何，别忘了当初让你眼睛发亮的那个瞬间。",
                1095,
            ),
            Fallback(
                "五年后的我在哪座城市",
                "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？" +
                    "此刻的我对未来有许多想象，也有一点不安。\n\n" +
                    "等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。" +
                    "不管落脚在哪，希望你过得踏实、自在。",
                1825,
            ),
            Fallback(
                "十年后还在听同一首歌吗",
                "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，" +
                    "看看那时的你听到它，会想起什么。\n\n" +
                    "十年很长，足够很多东西改变。但有些旋律会一直留在心里，" +
                    "像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。",
                3650,
            ),
        )
    }
}

/** 读取仓库内 prompt 模板（缺失则空串，使用各服务内置默认模板）。 */
internal fun loadTemplate(config: AppConfig, relativePath: String): String = try {
    val file = File(config.repoRoot).absoluteFile.normalize().resolve(relativePath)
    if (file.exists()) file.readText() else ""
} catch (_: Exception) {
    ""
}
