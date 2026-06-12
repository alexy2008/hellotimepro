#pragma once

#include <drogon/utils/coroutine.h>
#include <json/json.h>

#include <memory>
#include <optional>
#include <string>

#include "config.h"
#include "llm_client.h"

// 由标题生成胶囊正文与开启天数建议。LLM 不可用时本地兜底（generatedBy=local-template）。
class SuggestionService
{
  public:
    SuggestionService(const AppConfig &config, std::shared_ptr<LlmClient> llm);

    drogon::Task<Json::Value> suggest(std::optional<std::string> title);

    // 清洗 LLM 标题：去换行 / 围栏符号 / 引号书名号，截到 60。
    static std::string cleanTitle(const std::string &raw);

    struct Fallback
    {
        std::string title;
        std::string content;
        int64_t days;
    };

    static Fallback fallback(bool autoTitle, const std::string &title);

  private:
    std::string buildPrompt(const std::string &title) const;

    AppConfig config_;
    std::shared_ptr<LlmClient> llm_;
    std::string promptTemplate_;
};
