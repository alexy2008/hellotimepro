import Foundation
import Vapor

/// 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
/// 契约测试默认 LLM_ENABLED=false，会在此立即抛异常，由上层走本地兜底；HTTP 路径不在测试链上。
struct LlmClient: Sendable {
    struct LlmError: Error {
        let message: String
        var status: Int = 0
    }

    struct SchemaSpec: Sendable {
        let schemaName: String
        let schema: JSON
        let systemPrompt: String
        let maxOutputTokens: Int
        let maxTokens: Int
    }

    let config: LlmConfig
    let client: any Client
    let logger: Logger

    func generateCapsuleSuggestion(prompt: String) async throws -> JSON {
        try await generateStructuredJson(prompt: prompt, spec: Self.suggestionSpec)
    }

    func generateCapsuleRecommendations(prompt: String) async throws -> JSON {
        try await generateStructuredJson(prompt: prompt, spec: Self.recommendationSpec)
    }

    private func generateStructuredJson(prompt: String, spec: SchemaSpec) async throws -> JSON {
        guard config.enabled, !config.apiKey.isEmpty else {
            throw LlmError(message: "LLM is disabled or missing API key")
        }
        switch config.apiStyle {
        case "responses":
            return try await generateWithResponses(prompt: prompt, spec: spec)
        case "auto":
            do {
                return try await generateWithResponses(prompt: prompt, spec: spec)
            } catch let e as LlmError {
                logger.info("Responses API unavailable (\(e.message)); falling back to chat completions")
                return try await generateWithChat(prompt: prompt, spec: spec, disableThinking: true)
            }
        default:
            return try await generateWithChat(prompt: prompt, spec: spec, disableThinking: true)
        }
    }

    private func generateWithResponses(prompt: String, spec: SchemaSpec) async throws -> JSON {
        let payload: JSON = .object([
            "model": .string(config.model),
            "input": .string(prompt),
            "max_output_tokens": .int(spec.maxOutputTokens),
            "text": .object([
                "format": .object([
                    "type": .string("json_schema"),
                    "name": .string(spec.schemaName),
                    "strict": .bool(true),
                    "schema": spec.schema,
                ]),
            ]),
        ])
        let body = try await postJson(url: responsesUrl, payload: payload)
        return try parseJsonObject(extractResponsesText(body))
    }

    private func generateWithChat(prompt: String, spec: SchemaSpec, disableThinking: Bool) async throws -> JSON {
        func payload(withThinking: Bool) -> JSON {
            var obj: [String: JSON] = [
                "model": .string(config.model),
                "messages": .array([
                    .object(["role": .string("system"), "content": .string(spec.systemPrompt)]),
                    .object(["role": .string("user"), "content": .string(prompt)]),
                ]),
                "max_tokens": .int(spec.maxTokens),
            ]
            if withThinking { obj["thinking"] = .object(["type": .string("disabled")]) }
            return .object(obj)
        }
        do {
            let body = try await postJson(url: chatUrl, payload: payload(withThinking: disableThinking))
            return try parseJsonObject(extractChatText(body))
        } catch let e as LlmError where e.status == 400 && disableThinking {
            // 某些网关不认 thinking 字段，去掉重试一次。
            let body = try await postJson(url: chatUrl, payload: payload(withThinking: false))
            return try parseJsonObject(extractChatText(body))
        }
    }

    /// 向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。
    private func postJson(url: String, payload: JSON) async throws -> JSON {
        let bodyData = try JSONEncoder().encode(payload)
        let attempts = max(1, config.maxRetries + 1)
        var lastError: Error?

        for attempt in 1...attempts {
            logger.info("LLM request  model=\(config.model) url=\(url) attempt=\(attempt)/\(attempts)")
            let start = Date()
            do {
                var headers = HTTPHeaders()
                headers.add(name: .authorization, value: "Bearer \(config.apiKey)")
                headers.add(name: .contentType, value: "application/json")
                headers.add(name: .accept, value: "application/json")
                headers.add(name: .userAgent, value: config.userAgent)
                let response = try await client.post(URI(string: url), headers: headers) { req in
                    req.body = ByteBuffer(data: bodyData)
                }
                let elapsed = Int(Date().timeIntervalSince(start) * 1000)
                let status = Int(response.status.code)
                guard (200..<300).contains(status) else {
                    logger.warning("LLM error    model=\(config.model) elapsed_ms=\(elapsed) status=\(status)")
                    let bodyText = response.body.map { String(buffer: $0) } ?? ""
                    throw LlmError(message: "HTTP \(status): \(bodyText.prefix(500))", status: status)
                }
                guard let buffer = response.body,
                      let parsed = try? JSONDecoder().decode(JSON.self, from: Data(buffer: buffer)),
                      parsed.objectValue != nil else {
                    logger.warning("LLM error    model=\(config.model) elapsed_ms=\(elapsed) error=invalid-json")
                    throw LlmError(message: "LLM response was not valid JSON")
                }
                logger.info("LLM response model=\(config.model) elapsed_ms=\(elapsed) tokens=\(extractTokens(parsed))")
                return parsed
            } catch let e as LlmError {
                throw e
            } catch {
                let elapsed = Int(Date().timeIntervalSince(start) * 1000)
                let willRetry = attempt < attempts
                logger.warning(
                    "LLM error    model=\(config.model) elapsed_ms=\(elapsed) error=\(error)\(willRetry ? " (will retry)" : "")"
                )
                lastError = error
                if willRetry {
                    try? await Task.sleep(nanoseconds: UInt64(config.retryBackoffMs * attempt) * 1_000_000)
                }
            }
        }
        throw LlmError(message: lastError.map { "\($0)" } ?? "LLM request failed")
    }

    private func extractTokens(_ body: JSON) -> String {
        guard let usage = body["usage"]?.objectValue else { return "n/a" }
        if let total = usage["total_tokens"]?.intValue, total > 0 { return String(total) }
        let sum = (usage["input_tokens"]?.intValue ?? 0) + (usage["output_tokens"]?.intValue ?? 0)
        return sum > 0 ? String(sum) : "n/a"
    }

    private func extractChatText(_ body: JSON) throws -> String {
        guard let choices = body["choices"]?.arrayValue,
              let content = choices.first?["message"]?["content"]?.stringValue,
              !content.isEmpty else {
            throw LlmError(message: "LLM chat response missing content")
        }
        return content
    }

    private func extractResponsesText(_ body: JSON) throws -> String {
        if let text = body["output_text"]?.stringValue, !text.isEmpty { return text }
        for item in body["output"]?.arrayValue ?? [] {
            for entry in item["content"]?.arrayValue ?? [] {
                if let text = entry["text"]?.stringValue, !text.isEmpty { return text }
            }
        }
        throw LlmError(message: "LLM response did not contain output text")
    }

    /// 解析 LLM 输出的 JSON 对象：剥代码块围栏；失败时截取首尾花括号再试一次。
    private func parseJsonObject(_ raw: String) throws -> JSON {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("```") {
            text = text.replacingOccurrences(of: "^```[a-zA-Z]*\\s*", with: "", options: .regularExpression)
                .replacingOccurrences(of: "\\s*```$", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let parsed = try? JSONDecoder().decode(JSON.self, from: Data(text.utf8)),
           parsed.objectValue != nil {
            return parsed
        }
        guard let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start < end,
              let parsed = try? JSONDecoder().decode(JSON.self, from: Data(text[start...end].utf8)),
              parsed.objectValue != nil else {
            throw LlmError(message: "LLM output was not valid JSON")
        }
        return parsed
    }

    private var baseUrl: String {
        let trimmed = config.baseUrl.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "https://api.openai.com/v1" }
        return String(trimmed.reversed().drop(while: { $0 == "/" }).reversed())
    }

    private var responsesUrl: String { baseUrl + "/responses" }
    private var chatUrl: String { baseUrl + "/chat/completions" }

    // ── 结构化输出 schema ─────────────────────────────────────────────────

    static let suggestionSpec = SchemaSpec(
        schemaName: "capsule_suggestion",
        schema: .object([
            "type": .string("object"),
            "additionalProperties": .bool(false),
            "required": .array([.string("title"), .string("content"), .string("openInDays")]),
            "properties": .object([
                "title": .object(["type": .string("string")]),
                "content": .object(["type": .string("string")]),
                "openInDays": .object([
                    "type": .string("integer"), "minimum": .int(1), "maximum": .int(3650),
                ]),
            ]),
        ]),
        systemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
            + "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
        maxOutputTokens: 900,
        maxTokens: 900
    )

    static let recommendationSpec = SchemaSpec(
        schemaName: "capsule_recommendations",
        schema: .object([
            "type": .string("object"),
            "additionalProperties": .bool(false),
            "required": .array([.string("items")]),
            "properties": .object([
                "items": .object([
                    "type": .string("array"),
                    "minItems": .int(3),
                    "maxItems": .int(8),
                    "items": .object([
                        "type": .string("object"),
                        "additionalProperties": .bool(false),
                        "required": .array([.string("title"), .string("hint"), .string("openInDays")]),
                        "properties": .object([
                            "title": .object(["type": .string("string")]),
                            "hint": .object(["type": .string("string")]),
                            "openInDays": .object([
                                "type": .string("integer"), "minimum": .int(1), "maximum": .int(3650),
                            ]),
                        ]),
                    ]),
                ]),
            ]),
        ]),
        systemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
            + "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
        maxOutputTokens: 900,
        maxTokens: 900
    )
}
