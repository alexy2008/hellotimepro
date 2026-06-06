namespace HelloTimePro.Aspnet.Config;

/// <summary>
/// 应用配置：全部来源于环境变量（由 <c>scripts/hello start aspnet</c> 注入），带合理默认值。
/// 对应 Ktor 的 <c>AppConfig</c> / Spring 的 <c>AppProperties</c>。
/// 教学项目：JWT secret 默认值等生产级问题不作处理。
/// </summary>
public sealed class AppConfig
{
    public string ServiceName { get; } = "hellotime-pro";
    public string ServiceVersion { get; } = "0.1.0";
    public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;
    public string Host { get; } = Env("HOST", "0.0.0.0");

    // hello CLI 不注入 PORT，默认端口必须直接是登记端口 29050（见 docs/dev-notes.md §6.5）。
    public int Port { get; } = int.Parse(Env("PORT", "29050"));

    public string DbDriver { get; } = Env("DB_DRIVER", "postgres");
    public string? DbUrl { get; } = Environment.GetEnvironmentVariable("DB_URL");

    // hello 不注入 REPO_ROOT；由 run 脚本导出，默认相对本目录上溯两级到仓库根。
    public string RepoRoot { get; } = Env("REPO_ROOT", "../..");

    public string JwtSecret { get; } = Env("JWT_SECRET", "dev-secret-change-me");
    public long AccessTokenTtlSeconds { get; } = long.Parse(Env("ACCESS_TOKEN_TTL_SECONDS", "3600"));
    public long RefreshTokenTtlSeconds { get; } = long.Parse(Env("REFRESH_TOKEN_TTL_SECONDS", "604800"));
    public int LoginRateLimitPerMinute { get; } = int.Parse(Env("LOGIN_RATE_LIMIT_PER_MINUTE", "10"));

    public LlmConfig Llm { get; } = new();

    // 单一 sqlite 判定规则：DB_DRIVER=sqlite 或 DB_URL=sqlite:///...。
    // AppConfig.IsSqlite 与 DbUrl.Resolve 共用此方法，保证 provider 选择、值转换器挂载、
    // 仓库行锁分支、health 报告四处永不漂移（见 docs/dev-notes.md §8.1）。
    public bool IsSqlite => ResolveIsSqlite(DbDriver, DbUrl);

    public static bool ResolveIsSqlite(string dbDriver, string? dbUrl) =>
        dbDriver == "sqlite" || (dbUrl?.Trim().StartsWith("sqlite:///") ?? false);

    public static string Env(string name, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? fallback : value;
    }
}

public sealed class LlmConfig
{
    public bool Enabled { get; } = AppConfig.Env("LLM_ENABLED", "false").Equals("true", StringComparison.OrdinalIgnoreCase);
    public string Provider { get; } = AppConfig.Env("LLM_PROVIDER", "openai");
    public string BaseUrl { get; } = AppConfig.Env("LLM_BASE_URL", "https://api.openai.com/v1");
    public string ApiKey { get; } = AppConfig.Env("LLM_API_KEY", "");
    public string Model { get; } = AppConfig.Env("LLM_MODEL", "gpt-4.1-mini");
    public long TimeoutMs { get; } = long.Parse(AppConfig.Env("LLM_TIMEOUT_MS", "30000"));

    // 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数，见 docs/dev-notes.md §3.3。
    public int MaxRetries { get; } = int.Parse(AppConfig.Env("LLM_MAX_RETRIES", "2"));
    public long RetryBackoffMs { get; } = long.Parse(AppConfig.Env("LLM_RETRY_BACKOFF_MS", "400"));

    // chat（默认，多数兼容网关只支持它）| responses | auto
    public string ApiStyle { get; } = AppConfig.Env("LLM_API_STYLE", "chat");

    // 避免被网关按默认 UA 封禁（Cloudflare 1010）。
    public string UserAgent { get; } = AppConfig.Env(
        "LLM_USER_AGENT",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
}
