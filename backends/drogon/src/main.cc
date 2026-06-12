#include <drogon/drogon.h>

#include <cstdlib>
#include <iostream>

#include "app_state.h"
#include "iso_date.h"
#include "json_util.h"
#include "routes.h"

std::shared_ptr<AppState> AppState::build(AppConfig config)
{
    auto state = std::make_shared<AppState>();
    state->db = Db::connect(config);
    state->avatars = std::make_shared<AvatarService>(config);
    state->rateLimiter =
        std::make_shared<LoginRateLimiter>(static_cast<size_t>(config.loginRateLimitPerMinute));
    state->llm = std::make_shared<LlmClient>(config.llm);
    state->suggestion = std::make_shared<SuggestionService>(config, state->llm);
    state->recommendation = std::make_shared<RecommendationService>(config, state->llm);
    state->startTimeMicros = iso_date::now();
    state->config = std::move(config);
    return state;
}

namespace
{
trantor::Logger::LogLevel parseLogLevel()
{
    std::string level = "info";
    if (const char *raw = std::getenv("LOG_LEVEL"))
        if (raw[0] != '\0')
            level = raw;
    for (auto &c : level)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    if (level == "trace")
        return trantor::Logger::kTrace;
    if (level == "debug")
        return trantor::Logger::kDebug;
    if (level == "warn" || level == "warning")
        return trantor::Logger::kWarn;
    if (level == "error")
        return trantor::Logger::kError;
    return trantor::Logger::kInfo;  // LLM 日志规范要求 INFO 可见
}
}  // namespace

int main()
{
    const AppConfig config = AppConfig::fromEnvironment();
    const std::string driver = config.isSqlite() ? "sqlite" : "postgres";

    std::shared_ptr<AppState> state;
    try
    {
        state = AppState::build(config);
    }
    catch (const std::exception &e)
    {
        std::cerr << "启动失败: " << e.what() << std::endl;
        return 1;
    }

    auto &app = drogon::app();
    app.setLogLevel(parseLogLevel());
    app.addListener(config.host, static_cast<uint16_t>(config.port));

    // 未匹配路由 → 契约 404 外壳（替代 drogon 默认 HTML 404）。
    app.setCustom404Page(envelope::error(ApiError::notFound("资源不存在")), false);

    // CORS：开发态宽松放行（前端经 :9080 代理是同源，这里只为直连调试兜底）。
    app.registerPreRoutingAdvice([](const drogon::HttpRequestPtr &req,
                                    drogon::AdviceCallback &&accb,
                                    drogon::AdviceChainCallback &&cccb) {
        if (req->method() == drogon::Options)
        {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k204NoContent);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            resp->addHeader("Access-Control-Allow-Methods",
                            "GET, POST, PATCH, DELETE, OPTIONS");
            resp->addHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
            accb(resp);
            return;
        }
        cccb();
    });
    app.registerPostHandlingAdvice(
        [](const drogon::HttpRequestPtr &, const drogon::HttpResponsePtr &resp) {
            resp->addHeader("Access-Control-Allow-Origin", "*");
        });

    registerRoutes(state);

    LOG_INFO << "hellotime-drogon listening on " << config.host << ":" << config.port
             << " (db=" << driver << ")";
    app.run();
    return 0;
}
