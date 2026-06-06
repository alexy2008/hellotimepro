using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using HelloTimePro.Aspnet.Config;

namespace HelloTimePro.Aspnet.Services;

/// <summary>
/// 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
/// 契约测试默认 LLM_ENABLED=false 时此处立即抛异常，由上层走本地兜底；HTTP 路径不在测试链上。
/// 单例：复用一个 HttpClient，超时用 per-request CancellationToken 控制。
/// </summary>
public sealed class LlmClient
{
    private readonly AppConfig _config;
    private readonly ILogger<LlmClient> _log;
    private readonly HttpClient _http;

    public LlmClient(AppConfig config, ILogger<LlmClient> log)
    {
        _config = config;
        _log = log;
        _http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
    }

    public sealed class LlmClientException : Exception
    {
        public int Status { get; }
        public LlmClientException(string message, int status = 0, Exception? cause = null) : base(message, cause)
            => Status = status;
    }

    private sealed record SchemaSpec(
        string SchemaName, JsonObject Schema, string SystemPrompt, int MaxOutputTokens, int MaxTokens);

    public Task<JsonObject> GenerateCapsuleSuggestion(string prompt) =>
        GenerateStructuredJson(prompt, SuggestionSpec);

    public Task<JsonObject> GenerateCapsuleRecommendations(string prompt) =>
        GenerateStructuredJson(prompt, RecommendationSpec);

    private async Task<JsonObject> GenerateStructuredJson(string prompt, SchemaSpec spec)
    {
        var llm = _config.Llm;
        if (!llm.Enabled || string.IsNullOrWhiteSpace(llm.ApiKey))
            throw new LlmClientException("LLM is disabled or missing API key");

        return llm.ApiStyle switch
        {
            "responses" => await GenerateWithResponses(prompt, spec),
            "auto" => await GenerateAuto(prompt, spec),
            _ => await GenerateWithChat(prompt, spec, disableThinking: true),
        };
    }

    private async Task<JsonObject> GenerateAuto(string prompt, SchemaSpec spec)
    {
        try
        {
            return await GenerateWithResponses(prompt, spec);
        }
        catch (LlmClientException e)
        {
            _log.LogInformation("Responses API unavailable ({Msg}); falling back to chat completions", e.Message);
            return await GenerateWithChat(prompt, spec, disableThinking: true);
        }
    }

    private async Task<JsonObject> GenerateWithResponses(string prompt, SchemaSpec spec)
    {
        var payload = new JsonObject
        {
            ["model"] = _config.Llm.Model,
            ["input"] = prompt,
            ["max_output_tokens"] = spec.MaxOutputTokens,
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_schema",
                    ["name"] = spec.SchemaName,
                    ["strict"] = true,
                    ["schema"] = spec.Schema.DeepClone(),
                },
            },
        };
        var body = await PostJson(ResponsesUrl(), payload);
        return ParseJsonObject(ExtractResponsesText(body));
    }

    private async Task<JsonObject> GenerateWithChat(string prompt, SchemaSpec spec, bool disableThinking)
    {
        JsonObject BuildPayload(bool withThinking) => new()
        {
            ["model"] = _config.Llm.Model,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = spec.SystemPrompt },
                new JsonObject { ["role"] = "user", ["content"] = prompt },
            },
            ["max_tokens"] = spec.MaxTokens,
            ["thinking"] = withThinking ? new JsonObject { ["type"] = "disabled" } : null,
        };

        try
        {
            var body = await PostJson(ChatUrl(), BuildPayload(disableThinking));
            return ParseJsonObject(ExtractChatText(body));
        }
        catch (LlmClientException e) when (e.Status == 400)
        {
            // 某些网关不认 thinking 字段，去掉重试一次。
            var body = await PostJson(ChatUrl(), BuildPayload(withThinking: false));
            return ParseJsonObject(ExtractChatText(body));
        }
    }

    /// <summary>向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。</summary>
    private async Task<JsonObject> PostJson(string url, JsonObject payload)
    {
        var llm = _config.Llm;
        var bodyText = payload.ToJsonString();
        var attempts = Math.Max(1, llm.MaxRetries + 1);
        Exception? lastError = null;

        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            _log.LogInformation("LLM request  model={Model} url={Url} attempt={Attempt}/{Attempts}",
                llm.Model, url, attempt, attempts);
            var start = Environment.TickCount64;
            using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(llm.TimeoutMs));
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(bodyText, Encoding.UTF8, "application/json");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", llm.ApiKey);
                request.Headers.Accept.ParseAdd("application/json");
                request.Headers.UserAgent.ParseAdd(llm.UserAgent);

                using var response = await _http.SendAsync(request, cts.Token);
                var elapsed = Environment.TickCount64 - start;
                var content = await response.Content.ReadAsStringAsync();
                var status = (int)response.StatusCode;
                if (status is < 200 or >= 300)
                {
                    _log.LogWarning("LLM error    model={Model} elapsed_ms={Elapsed} status={Status}",
                        llm.Model, elapsed, status);
                    throw new LlmClientException($"HTTP {status}: {content}", status);
                }

                JsonObject parsed;
                try
                {
                    parsed = JsonNode.Parse(content)!.AsObject();
                }
                catch (Exception e)
                {
                    _log.LogWarning("LLM error    model={Model} elapsed_ms={Elapsed} error=invalid-json", llm.Model, elapsed);
                    throw new LlmClientException("LLM response was not valid JSON", cause: e);
                }
                _log.LogInformation("LLM response model={Model} elapsed_ms={Elapsed} tokens={Tokens}",
                    llm.Model, elapsed, ExtractTokens(parsed));
                return parsed;
            }
            catch (LlmClientException)
            {
                throw; // HTTP / JSON 错误不重试。
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or IOException)
            {
                var elapsed = Environment.TickCount64 - start;
                var willRetry = attempt < attempts;
                _log.LogWarning("LLM error    model={Model} elapsed_ms={Elapsed} error={Error}{Retry}",
                    llm.Model, elapsed, e.Message, willRetry ? " (will retry)" : "");
                lastError = e;
                if (willRetry) await Task.Delay(TimeSpan.FromMilliseconds(llm.RetryBackoffMs * attempt));
            }
        }
        throw new LlmClientException(lastError?.Message ?? "LLM request failed", cause: lastError);
    }

    private static string ExtractTokens(JsonObject body)
    {
        if (body["usage"] is not JsonObject usage) return "n/a";
        if (TryLong(usage["total_tokens"], out var total) && total > 0) return total.ToString();
        var sum = (TryLong(usage["input_tokens"], out var inp) ? inp : 0) +
                  (TryLong(usage["output_tokens"], out var outp) ? outp : 0);
        return sum > 0 ? sum.ToString() : "n/a";
    }

    private static bool TryLong(JsonNode? node, out long value)
    {
        value = 0;
        if (node is null) return false;
        try { value = node.GetValue<long>(); return true; }
        catch { return long.TryParse(node.ToString(), out value); }
    }

    private static string ExtractChatText(JsonObject body)
    {
        if (body["choices"] is not JsonArray choices || choices.Count == 0)
            throw new LlmClientException("LLM chat response missing choices");
        var content = choices[0]?["message"]?["content"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(content))
            throw new LlmClientException("LLM chat response missing content");
        return content;
    }

    private static string ExtractResponsesText(JsonObject body)
    {
        if (body["output_text"] is JsonValue ot && ot.TryGetValue<string>(out var t) && !string.IsNullOrWhiteSpace(t))
            return t;
        if (body["output"] is JsonArray output)
        {
            foreach (var item in output)
            {
                if (item?["content"] is not JsonArray contentArr) continue;
                foreach (var entry in contentArr)
                {
                    if (entry?["text"] is JsonValue tv && tv.TryGetValue<string>(out var txt) && !string.IsNullOrWhiteSpace(txt))
                        return txt;
                }
            }
        }
        throw new LlmClientException("LLM response did not contain output text");
    }

    private static JsonObject ParseJsonObject(string raw)
    {
        var text = raw.Trim();
        if (text.StartsWith("```"))
        {
            text = System.Text.RegularExpressions.Regex.Replace(text, @"^```[a-zA-Z]*\s*", "");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\s*```$", "").Trim();
        }
        try
        {
            return JsonNode.Parse(text)!.AsObject();
        }
        catch
        {
            var start = text.IndexOf('{');
            var end = text.LastIndexOf('}');
            if (start < 0 || end <= start) throw new LlmClientException("LLM output was not valid JSON");
            return JsonNode.Parse(text[start..(end + 1)])!.AsObject();
        }
    }

    private string ResponsesUrl() => StripTrailingSlash(_config.Llm.BaseUrl) + "/responses";
    private string ChatUrl() => StripTrailingSlash(_config.Llm.BaseUrl) + "/chat/completions";

    private static string StripTrailingSlash(string value) =>
        string.IsNullOrWhiteSpace(value) ? "https://api.openai.com/v1" : value.TrimEnd('/');

    private static readonly SchemaSpec SuggestionSpec = new(
        SchemaName: "capsule_suggestion",
        Schema: new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray { "title", "content", "openInDays" },
            ["properties"] = new JsonObject
            {
                ["title"] = new JsonObject { ["type"] = "string" },
                ["content"] = new JsonObject { ["type"] = "string" },
                ["openInDays"] = new JsonObject { ["type"] = "integer", ["minimum"] = 1, ["maximum"] = 3650 },
            },
        },
        SystemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
                      "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
        MaxOutputTokens: 900,
        MaxTokens: 900);

    private static readonly SchemaSpec RecommendationSpec = new(
        SchemaName: "capsule_recommendations",
        Schema: new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray { "items" },
            ["properties"] = new JsonObject
            {
                ["items"] = new JsonObject
                {
                    ["type"] = "array",
                    ["minItems"] = 3,
                    ["maxItems"] = 8,
                    ["items"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["additionalProperties"] = false,
                        ["required"] = new JsonArray { "title", "hint", "openInDays" },
                        ["properties"] = new JsonObject
                        {
                            ["title"] = new JsonObject { ["type"] = "string" },
                            ["hint"] = new JsonObject { ["type"] = "string" },
                            ["openInDays"] = new JsonObject { ["type"] = "integer", ["minimum"] = 1, ["maximum"] = 3650 },
                        },
                    },
                },
            },
        },
        SystemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
                      "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
        MaxOutputTokens: 900,
        MaxTokens: 900);
}
