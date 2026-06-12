import Foundation
import Vapor

/// 由标题生成胶囊正文与开启天数建议。LLM 不可用时本地兜底（generatedBy=local-template）。
struct SuggestionService: Sendable {
    let config: AppConfig
    let llm: LlmClient
    let logger: Logger
    let promptTemplate: String

    init(config: AppConfig, llm: LlmClient, logger: Logger) {
        self.config = config
        self.llm = llm
        self.logger = logger
        self.promptTemplate = loadTemplate(config: config, relativePath: "spec/llm/capsule-suggestion.prompt.md")
    }

    func suggest(_ req: CapsuleSuggestionRequest) async throws -> JSON {
        if let title = req.title, title.count > 60 {
            throw ApiError.validation("标题长度不得超过 60", "title")
        }
        let title = req.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let autoTitle = title.isEmpty

        var generatedBy = "local-template"
        var resultTitle: String?
        var content: String?
        var days = 0

        do {
            let node = try await llm.generateCapsuleSuggestion(prompt: buildPrompt(title))
            var rawContent = node["content"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if rawContent.count > 5000 { rawContent = String(rawContent.prefix(5000)) }
            guard !rawContent.isEmpty else {
                throw LlmClient.LlmError(message: "LLM returned empty content")
            }
            guard let rawDays = node["openInDays"]?.intValue else {
                throw LlmClient.LlmError(message: "openInDays missing or not a number")
            }
            if autoTitle {
                let genTitle = Self.cleanTitle(node["title"]?.stringValue)
                guard !genTitle.isEmpty else {
                    throw LlmClient.LlmError(message: "LLM returned empty title in auto-title mode")
                }
                resultTitle = genTitle
            }
            content = rawContent
            days = min(max(rawDays, 1), 3650)
            generatedBy = "\(config.llm.provider):\(config.llm.model)"
        } catch {
            logger.warning("Capsule suggestion LLM failed; using local fallback: \(error)")
            let fb = Self.fallback(autoTitle: autoTitle, title: title)
            resultTitle = autoTitle ? fb.title : nil
            content = fb.content
            days = fb.days
        }

        let openAt = Date().addingTimeInterval(TimeInterval(days) * 86400)
        return .object([
            "title": .from(resultTitle),
            "content": .string(content!),
            "openInDays": .int(days),
            "openAt": .string(IsoDate.jsonString(openAt)),
            "generatedBy": .string(generatedBy),
            "cached": .bool(false),
        ])
    }

    private func buildPrompt(_ title: String) -> String {
        let template = promptTemplate.isEmpty ? Self.defaultPromptTemplate : promptTemplate
        return template
            .replacingOccurrences(of: "{TITLE_OR_EMPTY}", with: title)
            .replacingOccurrences(of: "{TITLE}", with: title)
    }

    /// 清洗 LLM 标题：去换行 / 围栏符号 / 引号书名号，截到 60。
    static func cleanTitle(_ raw: String?) -> String {
        var s = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "[\\r\\n]+", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "^[#*`　 \"'《》【】]+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[#*`　 \"'《》【】]+$", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        if s.count > 60 { s = String(s.prefix(60)) }
        return s
    }

    // ── 本地兜底 ───────────────────────────────────────────────────────────

    struct Fallback {
        let title: String
        let content: String
        let days: Int
    }

    static func fallback(autoTitle: Bool, title: String) -> Fallback {
        if autoTitle { return fallbackCapsules.randomElement()! }
        let days = [30, 90, 180, 365].randomElement()!
        let content = "写下《\(title)》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
            + "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
            + "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
            + "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
            + "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。"
        return Fallback(title: title, content: content, days: days)
    }

    static let defaultPromptTemplate =
        "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。"
        + "为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。"
        + "只返回严格 JSON：{\"title\":\"...\",\"content\":\"...\",\"openInDays\":30}。"

    static let fallbackCapsules: [Fallback] = [
        Fallback(
            title: "写给一个月后的自己",
            content: "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，"
                + "有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n"
                + "如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，"
                + "你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。",
            days: 30
        ),
        Fallback(
            title: "下个季度想完成的一件事",
            content: "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。"
                + "现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n"
                + "等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。"
                + "无论结果如何，请记得为当初愿意开始的自己鼓一次掌。",
            days: 90
        ),
        Fallback(
            title: "猜猜下届世界杯冠军是谁",
            content: "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。"
                + "此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n"
                + "等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，"
                + "希望那段为热爱呐喊的日子，依然让你觉得值得。",
            days: 365
        ),
        Fallback(
            title: "明年生日想对自己说的话",
            content: "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成"
                + "自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n"
                + "请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。",
            days: 365
        ),
        Fallback(
            title: "三年后还在做喜欢的事吗",
            content: "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。"
                + "此刻它带给我很多快乐，也带来一些迷茫。\n\n"
                + "如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。"
                + "无论如何，别忘了当初让你眼睛发亮的那个瞬间。",
            days: 1095
        ),
        Fallback(
            title: "五年后的我在哪座城市",
            content: "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？"
                + "此刻的我对未来有许多想象，也有一点不安。\n\n"
                + "等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。"
                + "不管落脚在哪，希望你过得踏实、自在。",
            days: 1825
        ),
        Fallback(
            title: "十年后还在听同一首歌吗",
            content: "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，"
                + "看看那时的你听到它，会想起什么。\n\n"
                + "十年很长，足够很多东西改变。但有些旋律会一直留在心里，"
                + "像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。",
            days: 3650
        ),
    ]
}

/// 读取仓库内 prompt 模板（缺失则空串，使用各服务内置默认模板）。
func loadTemplate(config: AppConfig, relativePath: String) -> String {
    let path = config.absRepoRoot + "/" + relativePath
    return (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
}
