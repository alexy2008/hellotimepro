import Foundation

/// 应用配置：全部来源于环境变量（由 `scripts/hello start vapor` 注入），带合理默认值。
///
/// 对应 Ktor 的 `AppConfig`。教学项目：JWT secret 默认值等生产级问题不作处理。
struct AppConfig: Sendable {
    let serviceName = "hellotime-pro"
    let serviceVersion = "0.1.0"
    let host: String
    /// hello CLI 不注入 PORT，默认端口必须直接是登记端口 29060（见 docs/dev-notes.md §6.5）。
    let port: Int
    let dbDriver: String
    let dbUrl: String?
    let repoRoot: String
    let jwtSecret: String
    let accessTokenTtlSeconds: Int
    let refreshTokenTtlSeconds: Int
    let loginRateLimitPerMinute: Int
    let llm: LlmConfig

    var isSqlite: Bool { dbDriver == "sqlite" || (dbUrl?.hasPrefix("sqlite") ?? false) }

    /// 仓库根的绝对路径（repoRoot 可能是相对 CWD 的 `../..`）。
    var absRepoRoot: String {
        URL(fileURLWithPath: repoRoot).standardizedFileURL.path
    }

    static func env(_ name: String, _ fallback: String) -> String {
        if let v = ProcessInfo.processInfo.environment[name], !v.isEmpty { return v }
        return fallback
    }

    static func fromEnvironment() -> AppConfig {
        AppConfig(
            host: env("HOST", "0.0.0.0"),
            port: Int(env("PORT", "29060")) ?? 29060,
            dbDriver: env("DB_DRIVER", "postgres"),
            dbUrl: ProcessInfo.processInfo.environment["DB_URL"].flatMap { $0.isEmpty ? nil : $0 },
            repoRoot: env("REPO_ROOT", "../.."),
            jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
            accessTokenTtlSeconds: Int(env("ACCESS_TOKEN_TTL_SECONDS", "3600")) ?? 3600,
            refreshTokenTtlSeconds: Int(env("REFRESH_TOKEN_TTL_SECONDS", "604800")) ?? 604_800,
            loginRateLimitPerMinute: Int(env("LOGIN_RATE_LIMIT_PER_MINUTE", "10")) ?? 10,
            llm: LlmConfig.fromEnvironment()
        )
    }
}

struct LlmConfig: Sendable {
    let enabled: Bool
    let provider: String
    let baseUrl: String
    let apiKey: String
    let model: String
    let timeoutMs: Int
    /// 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数，见 docs/dev-notes.md §3.3
    let maxRetries: Int
    let retryBackoffMs: Int
    /// chat（默认，多数兼容网关只支持它）| responses | auto
    let apiStyle: String
    /// 避免被网关按默认 UA 封禁（Cloudflare 1010）
    let userAgent: String

    static func fromEnvironment() -> LlmConfig {
        LlmConfig(
            enabled: AppConfig.env("LLM_ENABLED", "false") == "true",
            provider: AppConfig.env("LLM_PROVIDER", "openai"),
            baseUrl: AppConfig.env("LLM_BASE_URL", "https://api.openai.com/v1"),
            apiKey: AppConfig.env("LLM_API_KEY", ""),
            model: AppConfig.env("LLM_MODEL", "gpt-4.1-mini"),
            timeoutMs: Int(AppConfig.env("LLM_TIMEOUT_MS", "30000")) ?? 30_000,
            maxRetries: Int(AppConfig.env("LLM_MAX_RETRIES", "2")) ?? 2,
            retryBackoffMs: Int(AppConfig.env("LLM_RETRY_BACKOFF_MS", "400")) ?? 400,
            apiStyle: AppConfig.env("LLM_API_STYLE", "chat"),
            userAgent: AppConfig.env(
                "LLM_USER_AGENT",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
        )
    }
}
