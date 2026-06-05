package com.hellotimepro.ktor.service

import com.hellotimepro.ktor.config.AppConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import org.slf4j.LoggerFactory
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
 * 契约测试默认 LLM_ENABLED=false，会在此立即抛异常，由上层走本地兜底；HTTP 路径不在测试链上。
 */
class LlmClient(private val config: AppConfig) {
    private val log = LoggerFactory.getLogger(LlmClient::class.java)
    private val json = Json { ignoreUnknownKeys = true }

    class LlmClientException(message: String, val status: Int = 0, cause: Throwable? = null) :
        RuntimeException(message, cause)

    data class SchemaSpec(
        val schemaName: String,
        val schema: JsonObject,
        val systemPrompt: String,
        val maxOutputTokens: Int,
        val maxTokens: Int,
    )

    fun generateCapsuleSuggestion(prompt: String): JsonObject =
        generateStructuredJson(prompt, SUGGESTION_SPEC)

    fun generateCapsuleRecommendations(prompt: String): JsonObject =
        generateStructuredJson(prompt, RECOMMENDATION_SPEC)

    private fun generateStructuredJson(prompt: String, spec: SchemaSpec): JsonObject {
        val llm = config.llm
        if (!llm.enabled || llm.apiKey.isBlank()) {
            throw LlmClientException("LLM is disabled or missing API key")
        }
        return when (llm.apiStyle) {
            "responses" -> generateWithResponses(prompt, spec)
            "auto" -> try {
                generateWithResponses(prompt, spec)
            } catch (e: LlmClientException) {
                log.info("Responses API unavailable ({}); falling back to chat completions", e.message)
                generateWithChat(prompt, spec, disableThinking = true)
            }
            else -> generateWithChat(prompt, spec, disableThinking = true)
        }
    }

    private fun generateWithResponses(prompt: String, spec: SchemaSpec): JsonObject {
        val payload = buildJsonObject {
            put("model", config.llm.model)
            put("input", prompt)
            put("max_output_tokens", spec.maxOutputTokens)
            putJsonObject("text") {
                putJsonObject("format") {
                    put("type", "json_schema")
                    put("name", spec.schemaName)
                    put("strict", true)
                    put("schema", spec.schema)
                }
            }
        }
        return parseJsonObject(extractResponsesText(postJson(responsesUrl(), payload)))
    }

    private fun generateWithChat(prompt: String, spec: SchemaSpec, disableThinking: Boolean): JsonObject {
        val payload = buildJsonObject {
            put("model", config.llm.model)
            putJsonArray("messages") {
                add(buildJsonObject { put("role", "system"); put("content", spec.systemPrompt) })
                add(buildJsonObject { put("role", "user"); put("content", prompt) })
            }
            put("max_tokens", spec.maxTokens)
            if (disableThinking) putJsonObject("thinking") { put("type", "disabled") }
        }
        return try {
            parseJsonObject(extractChatText(postJson(chatUrl(), payload)))
        } catch (e: LlmClientException) {
            if (e.status != 400) throw e
            // 某些网关不认 thinking 字段，去掉重试一次。
            parseJsonObject(extractChatText(postJson(chatUrl(), buildJsonObject {
                put("model", config.llm.model)
                putJsonArray("messages") {
                    add(buildJsonObject { put("role", "system"); put("content", spec.systemPrompt) })
                    add(buildJsonObject { put("role", "user"); put("content", prompt) })
                }
                put("max_tokens", spec.maxTokens)
            })))
        }
    }

    /** 向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。 */
    private fun postJson(url: String, payload: JsonObject): JsonObject {
        val llm = config.llm
        val body = json.encodeToString(JsonObject.serializer(), payload)
        val client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(llm.timeoutMs)).build()
        val attempts = maxOf(1, llm.maxRetries + 1)
        var lastError: Exception? = null

        for (attempt in 1..attempts) {
            log.info("LLM request  model={} url={} attempt={}/{}", llm.model, url, attempt, attempts)
            val start = System.currentTimeMillis()
            try {
                val request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMillis(llm.timeoutMs))
                    .header("Authorization", "Bearer ${llm.apiKey}")
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("User-Agent", llm.userAgent)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build()
                val response = client.send(request, HttpResponse.BodyHandlers.ofString())
                val elapsed = System.currentTimeMillis() - start
                val status = response.statusCode()
                if (status < 200 || status >= 300) {
                    log.warn("LLM error    model={} elapsed_ms={} status={}", llm.model, elapsed, status)
                    throw LlmClientException("HTTP $status: ${response.body()}", status = status)
                }
                val parsed = try {
                    json.parseToJsonElement(response.body()).jsonObject
                } catch (e: Exception) {
                    log.warn("LLM error    model={} elapsed_ms={} error=invalid-json", llm.model, elapsed)
                    throw LlmClientException("LLM response was not valid JSON", cause = e)
                }
                log.info("LLM response model={} elapsed_ms={} tokens={}", llm.model, elapsed, extractTokens(parsed))
                return parsed
            } catch (e: IOException) {
                val elapsed = System.currentTimeMillis() - start
                val willRetry = attempt < attempts
                log.warn(
                    "LLM error    model={} elapsed_ms={} error={}{}",
                    llm.model, elapsed, e.message, if (willRetry) " (will retry)" else "",
                )
                lastError = e
                if (willRetry) Thread.sleep(llm.retryBackoffMs * attempt)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                throw LlmClientException("LLM request interrupted", cause = e)
            }
        }
        throw LlmClientException(lastError?.message ?: "LLM request failed", cause = lastError)
    }

    private fun extractTokens(body: JsonObject): String {
        val usage = body["usage"]?.jsonObject ?: return "n/a"
        (usage["total_tokens"]?.jsonPrimitive?.content?.toLongOrNull())?.let { if (it > 0) return it.toString() }
        val sum = (usage["input_tokens"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0) +
            (usage["output_tokens"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0)
        return if (sum > 0) sum.toString() else "n/a"
    }

    private fun extractChatText(body: JsonObject): String {
        val choices = body["choices"]?.jsonArray ?: throw LlmClientException("LLM chat response missing choices")
        val content = choices.firstOrNull()?.jsonObject
            ?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.contentOrNullSafe()
        if (content.isNullOrBlank()) throw LlmClientException("LLM chat response missing content")
        return content
    }

    private fun extractResponsesText(body: JsonObject): String {
        (body["output_text"] as? JsonPrimitive)?.contentOrNullSafe()?.let { if (it.isNotBlank()) return it }
        body["output"]?.jsonArray?.forEach { item ->
            item.jsonObject["content"]?.jsonArray?.forEach { entry ->
                (entry.jsonObject["text"] as? JsonPrimitive)?.contentOrNullSafe()?.let {
                    if (it.isNotBlank()) return it
                }
            }
        }
        throw LlmClientException("LLM response did not contain output text")
    }

    private fun parseJsonObject(raw: String): JsonObject {
        var text = raw.trim()
        if (text.startsWith("```")) {
            text = text.replace(Regex("^```[a-zA-Z]*\\s*"), "").replace(Regex("\\s*```$"), "").trim()
        }
        return try {
            json.parseToJsonElement(text).jsonObject
        } catch (_: Exception) {
            val start = text.indexOf('{')
            val end = text.lastIndexOf('}')
            if (start < 0 || end <= start) throw LlmClientException("LLM output was not valid JSON")
            json.parseToJsonElement(text.substring(start, end + 1)).jsonObject
        }
    }

    private fun JsonPrimitive.contentOrNullSafe(): String? = if (this.isString) this.content else this.content

    private fun stripTrailingSlash(value: String): String =
        if (value.isBlank()) "https://api.openai.com/v1"
        else value.trimEnd('/')

    private fun responsesUrl(): String = stripTrailingSlash(config.llm.baseUrl) + "/responses"
    private fun chatUrl(): String = stripTrailingSlash(config.llm.baseUrl) + "/chat/completions"

    companion object {
        private val SUGGESTION_SPEC = LlmClient.SchemaSpec(
            schemaName = "capsule_suggestion",
            schema = buildJsonObject {
                put("type", "object")
                put("additionalProperties", false)
                putJsonArray("required") { add("title"); add("content"); add("openInDays") }
                putJsonObject("properties") {
                    putJsonObject("title") { put("type", "string") }
                    putJsonObject("content") { put("type", "string") }
                    putJsonObject("openInDays") { put("type", "integer"); put("minimum", 1); put("maximum", 3650) }
                }
            },
            systemPrompt = "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
                "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
            maxOutputTokens = 900,
            maxTokens = 900,
        )

        private val RECOMMENDATION_SPEC = LlmClient.SchemaSpec(
            schemaName = "capsule_recommendations",
            schema = buildJsonObject {
                put("type", "object")
                put("additionalProperties", false)
                putJsonArray("required") { add("items") }
                putJsonObject("properties") {
                    putJsonObject("items") {
                        put("type", "array")
                        put("minItems", 3)
                        put("maxItems", 8)
                        putJsonObject("items") {
                            put("type", "object")
                            put("additionalProperties", false)
                            putJsonArray("required") { add("title"); add("hint"); add("openInDays") }
                            putJsonObject("properties") {
                                putJsonObject("title") { put("type", "string") }
                                putJsonObject("hint") { put("type", "string") }
                                putJsonObject("openInDays") {
                                    put("type", "integer"); put("minimum", 1); put("maximum", 3650)
                                }
                            }
                        }
                    }
                }
            },
            systemPrompt = "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
                "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
            maxOutputTokens = 900,
            maxTokens = 900,
        )
    }
}
