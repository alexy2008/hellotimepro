package com.hellotimepro.ktor.config

/**
 * 应用配置：全部来源于环境变量（由 `scripts/hello start ktor` 注入），带合理默认值。
 *
 * 对应 Spring 的 `AppProperties`。教学项目：JWT secret 默认值等生产级问题不作处理。
 */
data class AppConfig(
    val serviceName: String = "hellotime-pro",
    val serviceVersion: String = "0.1.0",
    val host: String = env("HOST", "0.0.0.0"),
    // hello CLI 不注入 PORT，默认端口必须直接是登记端口 29090（见 docs/dev-notes.md §6.5）。
    val port: Int = env("PORT", "29090").toInt(),
    val dbDriver: String = env("DB_DRIVER", "postgres"),
    val dbUrl: String? = System.getenv("DB_URL"),
    val repoRoot: String = env("REPO_ROOT", "../.."),
    val jwtSecret: String = env("JWT_SECRET", "dev-secret-change-me"),
    val accessTokenTtlSeconds: Long = env("ACCESS_TOKEN_TTL_SECONDS", "3600").toLong(),
    val refreshTokenTtlSeconds: Long = env("REFRESH_TOKEN_TTL_SECONDS", "604800").toLong(),
    val loginRateLimitPerMinute: Int = env("LOGIN_RATE_LIMIT_PER_MINUTE", "10").toInt(),
    val llm: LlmConfig = LlmConfig(),
) {
    val isSqlite: Boolean get() = dbDriver == "sqlite"

    companion object {
        fun env(name: String, default: String): String =
            System.getenv(name)?.takeIf { it.isNotBlank() } ?: default
    }
}

data class LlmConfig(
    val enabled: Boolean = AppConfig.env("LLM_ENABLED", "false").toBoolean(),
    val provider: String = AppConfig.env("LLM_PROVIDER", "openai"),
    val baseUrl: String = AppConfig.env("LLM_BASE_URL", "https://api.openai.com/v1"),
    val apiKey: String = AppConfig.env("LLM_API_KEY", ""),
    val model: String = AppConfig.env("LLM_MODEL", "gpt-4.1-mini"),
    val timeoutMs: Long = AppConfig.env("LLM_TIMEOUT_MS", "30000").toLong(),
    // 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数，见 docs/dev-notes.md §3.3
    val maxRetries: Int = AppConfig.env("LLM_MAX_RETRIES", "2").toInt(),
    val retryBackoffMs: Long = AppConfig.env("LLM_RETRY_BACKOFF_MS", "400").toLong(),
    // chat（默认，多数兼容网关只支持它）| responses | auto
    val apiStyle: String = AppConfig.env("LLM_API_STYLE", "chat"),
    // 避免被网关按默认 UA 封禁（Cloudflare 1010）
    val userAgent: String = AppConfig.env(
        "LLM_USER_AGENT",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ),
)
