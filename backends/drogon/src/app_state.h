#pragma once

#include <memory>

#include "avatar_service.h"
#include "config.h"
#include "db.h"
#include "llm_client.h"
#include "rate_limiter.h"
#include "recommendation_service.h"
#include "suggestion_service.h"

// 应用状态：手动装配（无 DI 容器），shared_ptr 注入各 handler 闭包。
struct AppState
{
    AppConfig config;
    std::shared_ptr<Db> db;
    std::shared_ptr<AvatarService> avatars;
    std::shared_ptr<LoginRateLimiter> rateLimiter;
    std::shared_ptr<LlmClient> llm;
    std::shared_ptr<SuggestionService> suggestion;
    std::shared_ptr<RecommendationService> recommendation;
    int64_t startTimeMicros{0};

    static std::shared_ptr<AppState> build(AppConfig config);
};
