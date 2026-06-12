#pragma once

#include <drogon/utils/coroutine.h>
#include <json/json.h>

#include <stdexcept>
#include <string>

#include "config.h"

// 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
// 契约测试默认 LLM_ENABLED=false，会在此立即抛 LlmError，由上层走本地兜底；
// HTTP 路径不在测试链上。

struct LlmError : std::runtime_error
{
    int status{0};

    explicit LlmError(const std::string &message, int status = 0)
        : std::runtime_error(message), status(status)
    {
    }
};

class LlmClient
{
  public:
    explicit LlmClient(LlmConfig config) : config_(std::move(config))
    {
    }

    drogon::Task<Json::Value> generateCapsuleSuggestion(std::string prompt);
    drogon::Task<Json::Value> generateCapsuleRecommendations(std::string prompt);

    // 解析 LLM 输出的 JSON 对象：剥代码块围栏；失败时截取首尾花括号再试一次。
    static Json::Value parseJsonObject(const std::string &raw);
    // 宽容的整数读取：LLM 偶尔返回 `30.0` 这类浮点形态。
    static bool valueAsInt(const Json::Value &v, int64_t &out);

    const LlmConfig &config() const
    {
        return config_;
    }

  private:
    struct SchemaSpec
    {
        const char *schemaName;
        Json::Value schema;
        const char *systemPrompt;
        int maxOutputTokens;
        int maxTokens;
    };

    drogon::Task<Json::Value> generateStructuredJson(std::string prompt,
                                                     const SchemaSpec &spec);
    drogon::Task<Json::Value> generateWithResponses(std::string prompt,
                                                    const SchemaSpec &spec);
    drogon::Task<Json::Value> generateWithChat(std::string prompt, const SchemaSpec &spec,
                                               bool disableThinking);
    drogon::Task<Json::Value> postJson(std::string path, Json::Value payload);

    static const SchemaSpec &suggestionSpec();
    static const SchemaSpec &recommendationSpec();

    LlmConfig config_;
};
