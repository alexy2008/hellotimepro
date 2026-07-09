using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using HelloTimePro.Models;

namespace HelloTimePro.Api;

// ============================================================
// ApiClient：纯 API 消费者，HttpClient + async/await（对照 react-ts api/client.ts
// 与 desktop/swiftui .../Networking/APIClient.swift）。
//
// - access token 存内存，refresh token 持久化；二者经回调注入（避免与 store 循环依赖）
// - access token 缺失 / 401(UNAUTHORIZED) 触发一次 refresh + 重放（单飞：并发只刷一次）
// - 原生直连 baseURL（默认 :9080 反代）。WinUI3 远端运行时经反向 SSH 隧道 → 127.0.0.1:9080
// ============================================================

/// API 异常：承载 HTTP 状态与后端错误码，供上层 catch 分流。
public sealed class ApiException : Exception
{
    public int Status { get; }
    public string? Code { get; }
    public IReadOnlyList<FieldError>? Details { get; }

    public ApiException(string message, int status, string? code, IReadOnlyList<FieldError>? details = null)
        : base(message)
    {
        Status = status;
        Code = code;
        Details = details;
    }

    public bool IsUnauthorized => Status == 401;
}

public sealed class ApiClient
{
    public Uri BaseUrl { get; }

    // 由 AppStore 注入（Configure）——避免 client ↔ store 循环依赖。
    public Func<string?> GetAccessToken { get; set; } = () => null;
    public Func<string?> GetRefreshToken { get; set; } = () => null;
    public Action<string, string> OnTokensRefreshed { get; set; } = (_, _) => { };
    public Action OnAuthLost { get; set; } = () => { };

    private readonly HttpClient _http = new();
    private readonly object _refreshLock = new();
    private Task<string?>? _refreshing;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static Uri ResolveBaseUrl()
    {
        var raw = Environment.GetEnvironmentVariable("HELLO_API_BASE")
                  ?? Environment.GetEnvironmentVariable("BACKEND_PROXY")
                  ?? "http://127.0.0.1:9080";
        return Uri.TryCreate(raw, UriKind.Absolute, out var u) ? u : new Uri("http://127.0.0.1:9080");
    }

    public ApiClient(Uri? baseUrl = null)
    {
        BaseUrl = baseUrl ?? ResolveBaseUrl();
    }

    // ---------- 资源 URL ----------

    public Uri AvatarUrl(string id) => new(BaseUrl, $"/static/avatars/{id}.svg");

    /// 把后端相对资源路径解析为绝对 URL。
    public Uri? ResolveAsset(string path)
    {
        if (path.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return Uri.TryCreate(path, UriKind.Absolute, out var abs) ? abs : null;
        return new Uri(BaseUrl, path);
    }

    // ---------- refresh（单飞）----------

    private Task<string?> TryRefreshAsync()
    {
        lock (_refreshLock)
        {
            if (_refreshing != null) return _refreshing;
            var rt = GetRefreshToken();
            if (rt == null) return Task.FromResult<string?>(null);
            _refreshing = RefreshCoreAsync(rt);
            return _refreshing;
        }
    }

    private async Task<string?> RefreshCoreAsync(string refreshToken)
    {
        try
        {
            var tokens = await RawRequestAsync<RefreshedTokens>(
                "/api/v1/auth/refresh", HttpMethod.Post, body: new RefreshRequest(refreshToken), token: null);
            OnTokensRefreshed(tokens.AccessToken, tokens.RefreshToken);
            return tokens.AccessToken;
        }
        catch
        {
            OnAuthLost();
            return null;
        }
        finally
        {
            lock (_refreshLock) { _refreshing = null; }
        }
    }

    // ---------- 核心请求（401 自动 refresh 重放）----------

    private async Task<T> RequestAsync<T>(
        string path, HttpMethod? method = null, IEnumerable<KeyValuePair<string, string>>? query = null,
        object? body = null, bool auth = true, bool retry = false)
    {
        method ??= HttpMethod.Get;
        string? token = null;
        if (auth) token = GetAccessToken() ?? await TryRefreshAsync();

        try
        {
            return await RawRequestAsync<T>(path, method, query, body, token);
        }
        catch (ApiException e)
        {
            if (e.Status == 401 && e.Code == "UNAUTHORIZED" && auth && !retry && GetRefreshToken() != null)
            {
                if (await TryRefreshAsync() != null)
                    return await RequestAsync<T>(path, method, query, body, auth, retry: true);
            }
            throw;
        }
    }

    private async Task RequestVoidAsync(
        string path, HttpMethod method, object? body = null, bool auth = true, bool retry = false)
    {
        string? token = null;
        if (auth) token = GetAccessToken() ?? await TryRefreshAsync();

        try
        {
            await SendAsync(path, method, null, body, token);
        }
        catch (ApiException e)
        {
            if (e.Status == 401 && e.Code == "UNAUTHORIZED" && auth && !retry && GetRefreshToken() != null)
            {
                if (await TryRefreshAsync() != null)
                {
                    await RequestVoidAsync(path, method, body, auth, retry: true);
                    return;
                }
            }
            throw;
        }
    }

    private async Task<T> RawRequestAsync<T>(
        string path, HttpMethod method, IEnumerable<KeyValuePair<string, string>>? query = null,
        object? body = null, string? token = null)
    {
        var data = await SendAsync(path, method, query, body, token);
        try
        {
            var env = JsonSerializer.Deserialize<Envelope<T>>(data, JsonOpts);
            if (env == null || env.Data == null) throw new ApiException("响应缺少 data 字段", 0, null);
            return env.Data;
        }
        catch (ApiException) { throw; }
        catch (Exception ex) { throw new ApiException($"数据解析失败：{ex.Message}", 0, null); }
    }

    private async Task<string> SendAsync(
        string path, HttpMethod method, IEnumerable<KeyValuePair<string, string>>? query,
        object? body, string? token)
    {
        var builder = new UriBuilder(new Uri(BaseUrl, path));
        if (query != null)
        {
            var qs = new List<string>();
            foreach (var kv in query)
                qs.Add($"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}");
            if (qs.Count > 0) builder.Query = string.Join("&", qs);
        }

        using var req = new HttpRequestMessage(method, builder.Uri);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (token != null) req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, body.GetType(), JsonOpts);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        HttpResponseMessage resp;
        try { resp = await _http.SendAsync(req); }
        catch (Exception ex) { throw new ApiException($"网络错误：{ex.Message}", 0, null); }

        using (resp)
        {
            if ((int)resp.StatusCode == 204) return "";
            var text = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                Envelope<object>? env = null;
                try { env = JsonSerializer.Deserialize<Envelope<object>>(text, JsonOpts); } catch { /* 非 JSON 错误体 */ }
                throw new ApiException(
                    env?.Message ?? $"请求失败（HTTP {(int)resp.StatusCode}）",
                    (int)resp.StatusCode, env?.ErrorCode, env?.Details);
            }
            return text;
        }
    }

    // ---------- 端点 ----------

    public Task<HealthData> HealthAsync() => RequestAsync<HealthData>("/api/v1/health", auth: false);

    public Task<CapsuleSuggestion> SuggestCapsuleAsync(string? title) =>
        RequestAsync<CapsuleSuggestion>("/api/v1/capsule-suggestion", HttpMethod.Post,
            body: new CapsuleSuggestionRequest(title, null), auth: false);

    public Task<CapsuleRecommendationList> CapsuleRecommendationsAsync(int count = 4) =>
        RequestAsync<CapsuleRecommendationList>("/api/v1/capsule-recommendations",
            query: new[] { new KeyValuePair<string, string>("count", count.ToString()) }, auth: false);

    public Task<List<Avatar>> AvatarsAsync() => RequestAsync<List<Avatar>>("/api/v1/avatars", auth: false);

    // ---- 鉴权
    public Task<AuthTokens> RegisterAsync(RegisterRequest r) =>
        RequestAsync<AuthTokens>("/api/v1/auth/register", HttpMethod.Post, body: r, auth: false);

    public Task<AuthTokens> LoginAsync(LoginRequest r) =>
        RequestAsync<AuthTokens>("/api/v1/auth/login", HttpMethod.Post, body: r, auth: false);

    public Task LogoutAsync(string? refreshToken) =>
        RequestVoidAsync("/api/v1/auth/logout", HttpMethod.Post,
            body: refreshToken != null ? new LogoutRequest(refreshToken) : new object(), auth: false);

    // ---- 当前用户
    public Task<User> MeAsync() => RequestAsync<User>("/api/v1/me");
    public Task<User> UpdateProfileAsync(UpdateProfileRequest r) =>
        RequestAsync<User>("/api/v1/me", HttpMethod.Patch, body: r);
    public Task ChangePasswordAsync(ChangePasswordRequest r) =>
        RequestVoidAsync("/api/v1/me/password", HttpMethod.Post, body: r);

    // ---- 胶囊
    public Task<CapsuleDetail> CreateCapsuleAsync(CreateCapsuleRequest r) =>
        RequestAsync<CapsuleDetail>("/api/v1/capsules", HttpMethod.Post, body: r);
    public Task<CapsuleDetail> CapsuleByCodeAsync(string code) =>
        RequestAsync<CapsuleDetail>($"/api/v1/capsules/{Uri.EscapeDataString(code)}");

    // ---- 广场
    public Task<Page<CapsuleListItem>> PlazaAsync(string sort, string filter, string q, int page, int pageSize = 15)
    {
        var query = new List<KeyValuePair<string, string>>
        {
            new("sort", sort), new("filter", filter),
            new("page", page.ToString()), new("pageSize", pageSize.ToString()),
        };
        var t = q.Trim();
        if (t.Length > 0) query.Add(new("q", t));
        return RequestAsync<Page<CapsuleListItem>>("/api/v1/plaza/capsules", query: query);
    }

    // ---- 我创建的
    public Task<Page<CapsuleListItem>> MyCapsulesAsync(int page, int pageSize = 15) =>
        RequestAsync<Page<CapsuleListItem>>("/api/v1/me/capsules",
            query: new[] { new KeyValuePair<string, string>("page", page.ToString()),
                           new KeyValuePair<string, string>("pageSize", pageSize.ToString()) });
    public Task DeleteCapsuleAsync(string id) =>
        RequestVoidAsync($"/api/v1/me/capsules/{Uri.EscapeDataString(id)}", HttpMethod.Delete);

    // ---- 收藏
    public Task<Page<CapsuleListItem>> MyFavoritesAsync(int page, int pageSize = 15) =>
        RequestAsync<Page<CapsuleListItem>>("/api/v1/me/favorites",
            query: new[] { new KeyValuePair<string, string>("page", page.ToString()),
                           new KeyValuePair<string, string>("pageSize", pageSize.ToString()) });
    public Task<FavoriteResult> FavoriteAsync(string capsuleId) =>
        RequestAsync<FavoriteResult>("/api/v1/me/favorites", HttpMethod.Post, body: new FavoriteRequest(capsuleId));
    public Task UnfavoriteAsync(string capsuleId) =>
        RequestVoidAsync($"/api/v1/me/favorites/{Uri.EscapeDataString(capsuleId)}", HttpMethod.Delete);

    private sealed record RefreshedTokens
    {
        public string AccessToken { get; init; } = "";
        public string RefreshToken { get; init; } = "";
    }
}
