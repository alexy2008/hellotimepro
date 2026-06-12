#pragma once

#include <drogon/utils/coroutine.h>
#include <json/json.h>

#include <memory>
#include <string>

#include "config.h"
#include "llm_client.h"

// 创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。
class RecommendationService
{
  public:
    static constexpr int64_t kMinItems = 3;
    static constexpr int64_t kMaxItems = 8;

    RecommendationService(const AppConfig &config, std::shared_ptr<LlmClient> llm);

    drogon::Task<Json::Value> getRecommendations(int64_t count, std::string locale);

    // 解析 items：去重标题、钳位天数、跳过缺字段项；公开供单元测试。
    static Json::Value parseItems(const Json::Value &raw, size_t limit);

  private:
    std::string buildPrompt(int64_t count) const;

    AppConfig config_;
    std::shared_ptr<LlmClient> llm_;
    std::string promptTemplate_;
};
