#pragma once

#include <string>

// 应用配置：全部来源于环境变量（由 `scripts/hello start drogon` 注入），带合理默认值。
// 对应 Axum 的 AppConfig。教学项目：JWT secret 默认值等生产级问题不作处理。

struct LlmConfig
{
    bool enabled{false};
    std::string provider{"openai"};
    std::string baseUrl{"https://api.openai.com/v1"};
    std::string apiKey;
    std::string model{"gpt-4.1-mini"};
    int timeoutMs{30000};
    // 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数，见 docs/dev-notes.md §3.3
    int maxRetries{2};
    int retryBackoffMs{400};
    // chat（默认，多数兼容网关只支持它）| responses | auto
    std::string apiStyle{"chat"};
    // 避免被网关按默认 UA 封禁（Cloudflare 1010）
    std::string userAgent;

    static LlmConfig fromEnvironment();
};

struct AppConfig
{
    std::string serviceName{"hellotime-pro"};
    std::string serviceVersion{"0.1.0"};
    std::string host{"0.0.0.0"};
    // hello CLI 不注入 PORT，默认端口必须直接是登记端口 29080（见 docs/dev-notes.md §6.5）。
    int port{29080};
    std::string dbDriver{"postgres"};
    std::string dbUrl;
    std::string repoRoot{"../.."};
    std::string jwtSecret{"dev-secret-change-me"};
    int accessTokenTtlSeconds{3600};
    int refreshTokenTtlSeconds{604800};
    int loginRateLimitPerMinute{10};
    LlmConfig llm;

    static AppConfig fromEnvironment();

    bool isSqlite() const;
    // 仓库根的绝对路径（repoRoot 可能是相对 CWD 的 `../..`）。
    std::string absRepoRoot() const;
};
