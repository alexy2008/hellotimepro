#include "config.h"

#include <cstdlib>
#include <filesystem>

namespace
{
std::string envOr(const char *name, const std::string &fallback)
{
    const char *v = std::getenv(name);
    if (v != nullptr && v[0] != '\0')
        return v;
    return fallback;
}

int envInt(const char *name, int fallback)
{
    try
    {
        return std::stoi(envOr(name, std::to_string(fallback)));
    }
    catch (...)
    {
        return fallback;
    }
}
}  // namespace

LlmConfig LlmConfig::fromEnvironment()
{
    LlmConfig c;
    c.enabled = envOr("LLM_ENABLED", "false") == "true";
    c.provider = envOr("LLM_PROVIDER", "openai");
    c.baseUrl = envOr("LLM_BASE_URL", "https://api.openai.com/v1");
    c.apiKey = envOr("LLM_API_KEY", "");
    c.model = envOr("LLM_MODEL", "gpt-4.1-mini");
    c.timeoutMs = envInt("LLM_TIMEOUT_MS", 30000);
    c.maxRetries = envInt("LLM_MAX_RETRIES", 2);
    c.retryBackoffMs = envInt("LLM_RETRY_BACKOFF_MS", 400);
    c.apiStyle = envOr("LLM_API_STYLE", "chat");
    c.userAgent = envOr("LLM_USER_AGENT",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    return c;
}

AppConfig AppConfig::fromEnvironment()
{
    AppConfig c;
    c.host = envOr("HOST", "0.0.0.0");
    c.port = envInt("PORT", 29080);
    c.dbDriver = envOr("DB_DRIVER", "postgres");
    c.dbUrl = envOr("DB_URL", "");
    c.repoRoot = envOr("REPO_ROOT", "../..");
    c.jwtSecret = envOr("JWT_SECRET", "dev-secret-change-me");
    c.accessTokenTtlSeconds = envInt("ACCESS_TOKEN_TTL_SECONDS", 3600);
    c.refreshTokenTtlSeconds = envInt("REFRESH_TOKEN_TTL_SECONDS", 604800);
    c.loginRateLimitPerMinute = envInt("LOGIN_RATE_LIMIT_PER_MINUTE", 10);
    c.llm = LlmConfig::fromEnvironment();
    return c;
}

bool AppConfig::isSqlite() const
{
    return dbDriver == "sqlite" || dbUrl.rfind("sqlite", 0) == 0;
}

std::string AppConfig::absRepoRoot() const
{
    std::error_code ec;
    auto canonical = std::filesystem::canonical(repoRoot, ec);
    if (ec)
        return repoRoot;
    return canonical.string();
}
