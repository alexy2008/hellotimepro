import Foundation
import Vapor

/// 创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。
struct RecommendationService: Sendable {
    static let minItems = 3
    static let maxItems = 8

    let config: AppConfig
    let llm: LlmClient
    let logger: Logger
    let promptTemplate: String

    init(config: AppConfig, llm: LlmClient, logger: Logger) {
        self.config = config
        self.llm = llm
        self.logger = logger
        self.promptTemplate = loadTemplate(config: config, relativePath: "spec/llm/capsule-recommendation.prompt.md")
    }

    func getRecommendations(count: Int, locale: String) async -> JSON {
        let n = min(max(count, Self.minItems), Self.maxItems)
        var items: [JSON] = []
        do {
            let node = try await llm.generateCapsuleRecommendations(prompt: buildPrompt(n))
            items = Self.parseItems(node["items"], limit: n)
        } catch {
            logger.info("Capsule recommendations unavailable; returning empty list: \(error)")
        }
        let generatedBy = items.isEmpty ? "none" : "\(config.llm.provider):\(config.llm.model)"
        return .object([
            "items": .array(items),
            "generatedBy": .string(generatedBy),
            "cached": .bool(false),
        ])
    }

    private func buildPrompt(_ count: Int) -> String {
        let template = promptTemplate.isEmpty ? Self.defaultPromptTemplate : promptTemplate
        return template.replacingOccurrences(of: "{COUNT}", with: String(count))
    }

    static func parseItems(_ raw: JSON?, limit: Int) -> [JSON] {
        guard let array = raw?.arrayValue else { return [] }
        var items: [JSON] = []
        var seen = Set<String>()
        for entry in array {
            let title = clean(entry["title"]?.stringValue, limit: 60)
            let hint = clean(entry["hint"]?.stringValue, limit: 80)
            guard !title.isEmpty, !hint.isEmpty, !seen.contains(title),
                  let rawDays = entry["openInDays"]?.intValue else { continue }
            seen.insert(title)
            items.append(.object([
                "title": .string(title),
                "hint": .string(hint),
                "openInDays": .int(min(max(rawDays, 1), 3650)),
            ]))
            if items.count >= limit { break }
        }
        return items
    }

    private static func clean(_ raw: String?, limit: Int) -> String {
        var s = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "[\\r\\n]+", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "^[#*`　 \"'《》【】]+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[#*`　 \"'《》【】]+$", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        if s.count > limit { s = String(s.prefix(limit)) }
        return s
    }

    static let defaultPromptTemplate =
        "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。"
        + "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。"
        + "只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。"
}
