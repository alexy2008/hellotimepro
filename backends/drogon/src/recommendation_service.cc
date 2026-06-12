#include "recommendation_service.h"

#include <trantor/utils/Logger.h>

#include <algorithm>
#include <fstream>
#include <set>
#include <sstream>

#include "mapper.h"
#include "suggestion_service.h"
#include "validation.h"

namespace
{
std::string loadTemplate(const AppConfig &config, const std::string &relativePath)
{
    std::ifstream in(config.absRepoRoot() + "/" + relativePath);
    if (!in)
        return "";
    std::ostringstream out;
    out << in.rdbuf();
    return out.str();
}

constexpr const char *kDefaultPromptTemplate =
    "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。"
    "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。"
    "只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。";

std::string clean(const Json::Value &v, size_t limit)
{
    if (!v.isString())
        return "";
    // 与标题清洗共用同一套修饰符剥离逻辑。
    std::string s = SuggestionService::cleanTitle(v.asString());
    if (validation::codepointCount(s) > limit)
        s = mapper::truncateCodepoints(s, limit);
    return s;
}
}  // namespace

RecommendationService::RecommendationService(const AppConfig &config,
                                             std::shared_ptr<LlmClient> llm)
    : config_(config), llm_(std::move(llm)),
      promptTemplate_(loadTemplate(config, "spec/llm/capsule-recommendation.prompt.md"))
{
}

drogon::Task<Json::Value> RecommendationService::getRecommendations(int64_t count,
                                                                    std::string locale)
{
    (void)locale;
    const int64_t n = std::clamp(count, kMinItems, kMaxItems);
    Json::Value items(Json::arrayValue);
    try
    {
        const Json::Value node =
            co_await llm_->generateCapsuleRecommendations(buildPrompt(n));
        items = parseItems(node["items"], static_cast<size_t>(n));
    }
    catch (const std::exception &e)
    {
        LOG_INFO << "Capsule recommendations unavailable; returning empty list: " << e.what();
    }
    Json::Value out(Json::objectValue);
    out["items"] = items;
    out["generatedBy"] = items.empty()
                             ? std::string("none")
                             : config_.llm.provider + ":" + config_.llm.model;
    out["cached"] = false;
    co_return out;
}

std::string RecommendationService::buildPrompt(int64_t count) const
{
    std::string prompt = promptTemplate_.empty() ? kDefaultPromptTemplate : promptTemplate_;
    const std::string marker = "{COUNT}";
    size_t pos = 0;
    while ((pos = prompt.find(marker, pos)) != std::string::npos)
    {
        prompt.replace(pos, marker.size(), std::to_string(count));
        pos += 2;
    }
    return prompt;
}

Json::Value RecommendationService::parseItems(const Json::Value &raw, size_t limit)
{
    Json::Value items(Json::arrayValue);
    if (!raw.isArray())
        return items;
    std::set<std::string> seen;
    for (const auto &entry : raw)
    {
        const std::string title = clean(entry["title"], 60);
        const std::string hint = clean(entry["hint"], 80);
        int64_t rawDays = 0;
        if (title.empty() || hint.empty() || seen.count(title) ||
            !LlmClient::valueAsInt(entry["openInDays"], rawDays))
            continue;
        seen.insert(title);
        Json::Value item(Json::objectValue);
        item["title"] = title;
        item["hint"] = hint;
        item["openInDays"] = Json::Int64(std::clamp<int64_t>(rawDays, 1, 3650));
        items.append(item);
        if (items.size() >= limit)
            break;
    }
    return items;
}
