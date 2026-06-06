using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Dto;

namespace HelloTimePro.Aspnet.Services;

/// <summary>创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。</summary>
public sealed partial class CapsuleRecommendationService
{
    private const int MinItems = 3;
    private const int MaxItems = 8;

    private readonly AppConfig _config;
    private readonly LlmClient _llm;
    private readonly ILogger<CapsuleRecommendationService> _log;
    private readonly string _promptTemplate;

    public CapsuleRecommendationService(AppConfig config, LlmClient llm, ILogger<CapsuleRecommendationService> log)
    {
        _config = config;
        _llm = llm;
        _log = log;
        _promptTemplate = Templates.Load(config, "spec/llm/capsule-recommendation.prompt.md");
    }

    public async Task<CapsuleRecommendationList> GetRecommendations(int count, string locale)
    {
        var n = Math.Clamp(count, MinItems, MaxItems);
        var items = new List<CapsuleRecommendationItem>();
        try
        {
            var node = await _llm.GenerateCapsuleRecommendations(BuildPrompt(n));
            items = ParseItems(node["items"], n);
        }
        catch (Exception e) when (e is LlmClient.LlmClientException or ArgumentException)
        {
            _log.LogInformation("Capsule recommendations unavailable; returning empty list: {Msg}", e.Message);
        }
        var generatedBy = items.Count == 0 ? "none" : $"{_config.Llm.Provider}:{_config.Llm.Model}";
        return new CapsuleRecommendationList(items, generatedBy, false);
    }

    private string BuildPrompt(int count)
    {
        var template = string.IsNullOrWhiteSpace(_promptTemplate) ? DefaultPromptTemplate : _promptTemplate;
        return template.Replace("{COUNT}", count.ToString());
    }

    private static List<CapsuleRecommendationItem> ParseItems(JsonNode? raw, int limit)
    {
        var items = new List<CapsuleRecommendationItem>();
        if (raw is not JsonArray array) return items;
        var seen = new HashSet<string>();
        foreach (var entry in array)
        {
            if (entry is not JsonObject obj) continue;
            var title = Clean(obj["title"].StringOrNull(), 60);
            var hint = Clean(obj["hint"].StringOrNull(), 80);
            var days = ClampDays(obj["openInDays"].IntOrNull());
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(hint) || days is null || seen.Contains(title))
                continue;
            seen.Add(title);
            items.Add(new CapsuleRecommendationItem(title, hint, days.Value));
            if (items.Count >= limit) break;
        }
        return items;
    }

    [GeneratedRegex(@"[\r\n]+")]
    private static partial Regex Newlines();

    [GeneratedRegex("^[#*`　 \"'《》【】]+")]
    private static partial Regex LeadingTrim();

    [GeneratedRegex("[#*`　 \"'《》【】]+$")]
    private static partial Regex TrailingTrim();

    private static string Clean(string? raw, int limit)
    {
        var cleaned = Newlines().Replace((raw ?? "").Trim(), " ");
        cleaned = TrailingTrim().Replace(LeadingTrim().Replace(cleaned, ""), "").Trim();
        if (cleaned.Length > limit) cleaned = cleaned[..limit];
        return cleaned;
    }

    private static int? ClampDays(int? value) => value is null ? null : Math.Clamp(value.Value, 1, 3650);

    private const string DefaultPromptTemplate =
        "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。" +
        "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。" +
        "只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。";
}
