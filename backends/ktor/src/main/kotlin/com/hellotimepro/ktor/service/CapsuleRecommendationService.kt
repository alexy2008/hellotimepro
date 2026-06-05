package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.dto.CapsuleRecommendationItem
import com.hellotimepro.ktor.dto.CapsuleRecommendationList
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory

/** 创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。 */
class CapsuleRecommendationService(private val config: AppConfig, private val llm: LlmClient) {
    private val log = LoggerFactory.getLogger(CapsuleRecommendationService::class.java)
    private val promptTemplate: String = loadTemplate(config, "spec/llm/capsule-recommendation.prompt.md")

    suspend fun getRecommendations(count: Int, locale: String): CapsuleRecommendationList {
        val n = count.coerceIn(MIN_ITEMS, MAX_ITEMS)
        var items: List<CapsuleRecommendationItem> = emptyList()
        try {
            val node = withContext(Dispatchers.IO) { llm.generateCapsuleRecommendations(buildPrompt(n)) }
            items = parseItems(node["items"], n)
        } catch (e: LlmClient.LlmClientException) {
            log.info("Capsule recommendations unavailable; returning empty list: {}", e.message)
        } catch (e: IllegalArgumentException) {
            log.info("Capsule recommendations unavailable; returning empty list: {}", e.message)
        }
        val generatedBy = if (items.isEmpty()) "none" else "${config.llm.provider}:${config.llm.model}"
        return CapsuleRecommendationList(items, generatedBy, false)
    }

    private fun buildPrompt(count: Int): String {
        val template = promptTemplate.ifBlank { DEFAULT_PROMPT_TEMPLATE }
        return template.replace("{COUNT}", count.toString())
    }

    private fun parseItems(raw: JsonElement?, limit: Int): List<CapsuleRecommendationItem> {
        val array = (raw as? kotlinx.serialization.json.JsonArray) ?: return emptyList()
        val items = mutableListOf<CapsuleRecommendationItem>()
        val seen = mutableSetOf<String>()
        for (entry in array) {
            val obj = entry as? JsonObject ?: continue
            val title = clean(obj["title"]?.jsonPrimitive?.contentOrNull, 60)
            val hint = clean(obj["hint"]?.jsonPrimitive?.contentOrNull, 80)
            val days = clampDays(obj["openInDays"])
            if (title.isBlank() || hint.isBlank() || days == null || title in seen) continue
            seen.add(title)
            items.add(CapsuleRecommendationItem(title, hint, days))
            if (items.size >= limit) break
        }
        return items
    }

    private fun clean(raw: String?, limit: Int): String {
        var cleaned = (raw ?: "").trim().replace(Regex("[\\r\\n]+"), " ")
        cleaned = cleaned.replace(Regex("^[#*`　 \"'《》【】]+"), "").replace(Regex("[#*`　 \"'《》【】]+$"), "").trim()
        if (cleaned.length > limit) cleaned = cleaned.substring(0, limit)
        return cleaned
    }

    private fun clampDays(value: JsonElement?): Int? {
        val prim = value as? JsonPrimitive ?: return null
        val days = prim.intOrNull ?: prim.contentOrNull?.toDoubleOrNull()?.toInt() ?: return null
        return days.coerceIn(1, 3650)
    }

    companion object {
        private const val MIN_ITEMS = 3
        private const val MAX_ITEMS = 8
        private val DEFAULT_PROMPT_TEMPLATE =
            "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。" +
                "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。" +
                "只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。"
    }
}
