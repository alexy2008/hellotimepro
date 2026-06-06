using System.Text.RegularExpressions;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

/// <summary>由标题生成胶囊正文与开启天数建议。LLM 不可用时本地兜底（generatedBy=local-template）。</summary>
public sealed partial class CapsuleSuggestionService
{
    private readonly AppConfig _config;
    private readonly LlmClient _llm;
    private readonly ILogger<CapsuleSuggestionService> _log;
    private readonly string _promptTemplate;

    public CapsuleSuggestionService(AppConfig config, LlmClient llm, ILogger<CapsuleSuggestionService> log)
    {
        _config = config;
        _llm = llm;
        _log = log;
        _promptTemplate = Templates.Load(config, "spec/llm/capsule-suggestion.prompt.md");
    }

    public async Task<CapsuleSuggestion> Suggest(CapsuleSuggestionRequest req)
    {
        if (req.Title is { Length: > 60 })
            throw ApiException.Validation("标题长度不得超过 60", "title");

        var title = req.Title?.Trim() ?? "";
        var autoTitle = title.Length == 0;

        var generatedBy = "local-template";
        string? resultTitle = null;
        string? content = null;
        var days = 0;
        var ok = false;

        try
        {
            var node = await _llm.GenerateCapsuleSuggestion(BuildPrompt(title));
            var rawContent = (node["content"].StringOrNull() ?? "").Trim();
            if (rawContent.Length > 5000) rawContent = rawContent[..5000];
            if (string.IsNullOrWhiteSpace(rawContent)) throw new ArgumentException("LLM returned empty content");
            var rawDays = CoerceOpenInDays(node["openInDays"].IntOrNull());
            string? genTitle = null;
            if (autoTitle)
            {
                genTitle = TruncateTitle(node["title"].StringOrNull());
                if (string.IsNullOrWhiteSpace(genTitle))
                    throw new ArgumentException("LLM returned empty title in auto-title mode");
            }
            content = rawContent;
            days = rawDays;
            if (autoTitle) resultTitle = genTitle;
            generatedBy = $"{_config.Llm.Provider}:{_config.Llm.Model}";
            ok = true;
        }
        catch (Exception e) when (e is LlmClient.LlmClientException or ArgumentException)
        {
            _log.LogWarning("Capsule suggestion LLM failed; using local fallback: {Msg}", e.Message);
        }

        if (!ok)
        {
            var fb = Fallback(autoTitle, title);
            resultTitle = autoTitle ? fb.Title : null;
            content = fb.Content;
            days = fb.Days;
        }

        var openAt = Times.NowUtc().AddDays(days);
        return new CapsuleSuggestion(resultTitle, content!, days, Times.Iso(openAt), generatedBy, false);
    }

    private string BuildPrompt(string title)
    {
        var template = string.IsNullOrWhiteSpace(_promptTemplate) ? DefaultPromptTemplate : _promptTemplate;
        return template.Replace("{TITLE_OR_EMPTY}", title).Replace("{TITLE}", title);
    }

    [GeneratedRegex(@"[\r\n]+")]
    private static partial Regex Newlines();

    [GeneratedRegex("^[#*`　 \"'《》【】]+")]
    private static partial Regex LeadingTrim();

    [GeneratedRegex("[#*`　 \"'《》【】]+$")]
    private static partial Regex TrailingTrim();

    private static string TruncateTitle(string? raw)
    {
        var cleaned = Newlines().Replace((raw ?? "").Trim(), " ");
        cleaned = TrailingTrim().Replace(LeadingTrim().Replace(cleaned, ""), "").Trim();
        if (cleaned.Length > 60) cleaned = cleaned[..60];
        return cleaned;
    }

    private static int CoerceOpenInDays(int? value)
    {
        if (value is null) throw new ArgumentException("openInDays missing");
        return Math.Clamp(value.Value, 1, 3650);
    }

    private readonly record struct FallbackCapsule(string Title, string Content, int Days);

    private static FallbackCapsule Fallback(bool autoTitle, string title)
    {
        if (autoTitle) return FallbackCapsules[Random.Shared.Next(FallbackCapsules.Length)];
        var days = FallbackDays[Random.Shared.Next(FallbackDays.Length)];
        var content =
            $"写下《{title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。" +
            "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n" +
            "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、" +
            "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n" +
            "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
        return new FallbackCapsule(title, content, days);
    }

    private static readonly int[] FallbackDays = { 30, 90, 180, 365 };

    private const string DefaultPromptTemplate =
        "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。" +
        "为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。" +
        "只返回严格 JSON：{\"title\":\"...\",\"content\":\"...\",\"openInDays\":30}。";

    private static readonly FallbackCapsule[] FallbackCapsules =
    {
        new("写给一个月后的自己",
            "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，" +
            "有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n" +
            "如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，" +
            "你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。", 30),
        new("下个季度想完成的一件事",
            "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。" +
            "现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n" +
            "等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。" +
            "无论结果如何，请记得为当初愿意开始的自己鼓一次掌。", 90),
        new("猜猜下届世界杯冠军是谁",
            "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。" +
            "此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n" +
            "等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，" +
            "希望那段为热爱呐喊的日子，依然让你觉得值得。", 365),
        new("明年生日想对自己说的话",
            "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成" +
            "自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n" +
            "请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。", 365),
        new("三年后还在做喜欢的事吗",
            "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。" +
            "此刻它带给我很多快乐，也带来一些迷茫。\n\n" +
            "如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。" +
            "无论如何，别忘了当初让你眼睛发亮的那个瞬间。", 1095),
        new("五年后的我在哪座城市",
            "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？" +
            "此刻的我对未来有许多想象，也有一点不安。\n\n" +
            "等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。" +
            "不管落脚在哪，希望你过得踏实、自在。", 1825),
        new("十年后还在听同一首歌吗",
            "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，" +
            "看看那时的你听到它，会想起什么。\n\n" +
            "十年很长，足够很多东西改变。但有些旋律会一直留在心里，" +
            "像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。", 3650),
    };
}
