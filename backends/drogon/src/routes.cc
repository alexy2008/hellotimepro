#include "routes.h"

#include <drogon/drogon.h>
#include <drogon/orm/Exception.h>

#include <filesystem>

#include "api_error.h"
#include "iso_date.h"
#include "json_util.h"
#include "mapper.h"
#include "services.h"

using drogon::HttpRequestPtr;
using drogon::HttpResponsePtr;
using drogon::Task;

namespace
{
// 统一异常 → 契约错误外壳。所有 handler 主体经此包装。
template <typename F>
Task<HttpResponsePtr> guarded(F body)
{
    try
    {
        co_return co_await body();
    }
    catch (const ApiError &e)
    {
        co_return envelope::error(e);
    }
    catch (const drogon::orm::DrogonDbException &e)
    {
        LOG_ERROR << "Database error: " << e.base().what();
        co_return envelope::error(ApiError::internal("服务器内部错误"));
    }
    catch (const std::exception &e)
    {
        LOG_ERROR << "Unhandled error: " << e.what();
        co_return envelope::error(ApiError::internal("服务器内部错误"));
    }
}

// 请求体必须是 JSON 对象；坏 JSON / 非对象 → 422。
Json::Value requireJsonBody(const HttpRequestPtr &req)
{
    const auto json = req->getJsonObject();
    if (!json || !json->isObject())
        throw ApiError::invalidBody();
    return *json;
}

// 缺失才用默认值；存在但非整数 → 422（对齐 openapi 的 integer 约束）。
int64_t intParam(const HttpRequestPtr &req, const std::string &name, int64_t fallback)
{
    const auto &params = req->getParameters();
    const auto it = params.find(name);
    if (it == params.end())
        return fallback;
    try
    {
        size_t pos = 0;
        const int64_t v = std::stoll(it->second, &pos);
        if (pos != it->second.size())
            throw std::invalid_argument("trailing");
        return v;
    }
    catch (...)
    {
        throw ApiError::validation(name + " 必须是整数", name);
    }
}

std::optional<std::string> strParam(const HttpRequestPtr &req, const std::string &name)
{
    const auto &params = req->getParameters();
    const auto it = params.find(name);
    if (it == params.end())
        return std::nullopt;
    return it->second;
}

std::optional<std::string> optionalViewerId(const std::optional<User> &viewer)
{
    if (!viewer)
        return std::nullopt;
    return viewer->id;
}

Json::Value stackItem(const char *role, const char *name, const char *version,
                      const char *icon)
{
    Json::Value item(Json::objectValue);
    item["role"] = role;
    item["name"] = name;
    item["version"] = version;
    item["iconUrl"] = std::string("/static/icons/") + icon + ".svg";
    return item;
}

Json::Value healthData(const std::shared_ptr<AppState> &state)
{
    const bool isSqlite = state->db->isSqlite();
    Json::Value items(Json::arrayValue);
    items.append(stackItem("language", "C++", "20", "cpp"));
    items.append(stackItem("framework", "Drogon", "1.9", "drogon"));
    items.append(stackItem("runtime", "Trantor", "1", "cpp"));
    items.append(isSqlite ? stackItem("database", "SQLite", "3", "sqlite")
                          : stackItem("database", "PostgreSQL", "16", "postgresql"));

    Json::Value stack(Json::objectValue);
    stack["kind"] = "backend";
    stack["summary"] =
        "基于 C++20 + Drogon 的服务端实现。Trantor 事件循环承载 HTTP，C++20 协程全链路异步，"
        "Drogon ORM 手写参数化 SQL 同时驱动 PostgreSQL（连接池）与 SQLite（单连接天然串行）。"
        "跨库差异收敛在文本化编解码层：绑定参数统一为文本（PG 由列上下文推断类型，SQLite 走"
        "列亲和性），SQLite 存 32 位 hex UUID 与 ISO-8601 TEXT 时间戳。JWT（HS256，OpenSSL "
        "HMAC）手写签发校验 + refresh token 轮转与家族吊销实现鉴权；幂等 UPSERT + 原子自增"
        "维护收藏计数；OpenBSD bcrypt 与 seed 哈希互验；jsoncpp 显式输出契约要求的 null 字段。";
    stack["items"] = items;

    Json::Value data(Json::objectValue);
    data["status"] = "ok";
    data["service"] = state->config.serviceName;
    data["version"] = state->config.serviceVersion;
    data["uptimeSeconds"] =
        Json::Int64((iso_date::now() - state->startTimeMicros) / 1000000);
    data["stack"] = stack;
    return data;
}

// 提供 spec/ 下的静态 SVG（路径白名单 + 文件名防穿越）。
HttpResponsePtr serveSpecFile(const std::shared_ptr<AppState> &state,
                              const std::string &subdir, const std::string &file)
{
    if (file.find("..") != std::string::npos || file.find('/') != std::string::npos)
        throw ApiError::notFound("文件不存在");
    const std::string path = state->config.absRepoRoot() + "/" + subdir + "/" + file;
    if (!std::filesystem::exists(path))
        throw ApiError::notFound("文件不存在");
    std::string contentType = "application/octet-stream";
    if (file.size() > 4 && file.compare(file.size() - 4, 4, ".svg") == 0)
        contentType = "image/svg+xml";
    else if (file.size() > 5 && file.compare(file.size() - 5, 5, ".json") == 0)
        contentType = "application/json";
    auto resp = drogon::HttpResponse::newFileResponse(path);
    resp->addHeader("Content-Type", contentType);
    return resp;
}
}  // namespace

void registerRoutes(std::shared_ptr<AppState> state)
{
    auto &app = drogon::app();

    // ── 静态资源 ─────────────────────────────────────────────────────────────
    app.registerHandler(
        "/static/avatars/{file}",
        [state](HttpRequestPtr req, std::string file) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                co_return serveSpecFile(state, "spec/avatars", file);
            });
        },
        {drogon::Get});
    app.registerHandler(
        "/static/icons/{file}",
        [state](HttpRequestPtr req, std::string file) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                co_return serveSpecFile(state, "spec/icons", file);
            });
        },
        {drogon::Get});

    // ── Health / Avatars ─────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/health",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return envelope::ok(healthData(state));
        },
        {drogon::Get});
    app.registerHandler(
        "/api/v1/avatars",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return envelope::ok(state->avatars->list());
        },
        {drogon::Get});

    // ── Auth ─────────────────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/auth/register",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto body = requireJsonBody(req);
                co_return envelope::ok(co_await auth_service::registerUser(state, body),
                                       drogon::k201Created);
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/auth/login",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto body = requireJsonBody(req);
                co_return envelope::ok(co_await auth_service::login(state, body));
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/auth/refresh",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto body = requireJsonBody(req);
                std::optional<std::string> token;
                if (body["refreshToken"].isString())
                    token = body["refreshToken"].asString();
                co_return envelope::ok(co_await auth_service::refresh(state, token));
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/auth/logout",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                // 登出宽容处理：缺失/坏请求体一律视为无 token，仍然 204。
                std::optional<std::string> token;
                const auto json = req->getJsonObject();
                if (json && json->isObject() && (*json)["refreshToken"].isString())
                    token = (*json)["refreshToken"].asString();
                co_await auth_service::logout(state, token);
                co_return envelope::noContent();
            });
        },
        {drogon::Post});

    // ── Me ───────────────────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/me",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                co_return envelope::ok(mapper::user(user));
            });
        },
        {drogon::Get});
    app.registerHandler(
        "/api/v1/me",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                const auto body = requireJsonBody(req);
                co_return envelope::ok(
                    co_await user_service::updateProfile(state, user, body));
            });
        },
        {drogon::Patch});
    app.registerHandler(
        "/api/v1/me/password",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                const auto body = requireJsonBody(req);
                co_await auth_service::changePassword(state, user, body);
                co_return envelope::noContent();
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/me/capsules",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                co_return envelope::ok(co_await plaza_service::myCapsules(
                    state, user, intParam(req, "page", 1), intParam(req, "pageSize", 20)));
            });
        },
        {drogon::Get});
    app.registerHandler(
        "/api/v1/me/capsules/{id}",
        [state](HttpRequestPtr req, std::string id) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                co_await capsule_service::deleteOwn(state, user, id);
                co_return envelope::noContent();
            });
        },
        {drogon::Delete});

    // ── Capsules ─────────────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/capsules",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                const auto body = requireJsonBody(req);
                co_return envelope::ok(co_await capsule_service::create(state, user, body),
                                       drogon::k201Created);
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/capsules/{code}",
        [state](HttpRequestPtr req, std::string code) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto viewer = co_await auth_context::optionalUser(state, req);
                co_return envelope::ok(co_await capsule_service::getByCode(
                    state, code, optionalViewerId(viewer)));
            });
        },
        {drogon::Get});

    // ── Plaza ────────────────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/plaza/capsules",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto viewer = co_await auth_context::optionalUser(state, req);
                co_return envelope::ok(co_await plaza_service::plazaList(
                    state, strParam(req, "sort").value_or("new"),
                    strParam(req, "filter").value_or("all"), strParam(req, "q"),
                    intParam(req, "page", 1), intParam(req, "pageSize", 20),
                    optionalViewerId(viewer)));
            });
        },
        {drogon::Get});
    app.registerHandler(
        "/api/v1/plaza/capsules/{id}",
        [state](HttpRequestPtr req, std::string id) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto viewer = co_await auth_context::optionalUser(state, req);
                co_return envelope::ok(co_await capsule_service::getPlazaDetail(
                    state, id, optionalViewerId(viewer)));
            });
        },
        {drogon::Get});

    // ── Favorites ────────────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/me/favorites",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                co_return envelope::ok(co_await plaza_service::myFavorites(
                    state, user, intParam(req, "page", 1), intParam(req, "pageSize", 20)));
            });
        },
        {drogon::Get});
    app.registerHandler(
        "/api/v1/me/favorites",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                const auto body = requireJsonBody(req);
                std::optional<std::string> capsuleId;
                if (body["capsuleId"].isString())
                    capsuleId = body["capsuleId"].asString();
                co_return envelope::ok(
                    co_await favorite_service::addFavorite(state, user, capsuleId));
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/me/favorites/{capsuleId}",
        [state](HttpRequestPtr req, std::string capsuleId) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const User user = co_await auth_context::requiredUser(state, req);
                co_await favorite_service::removeFavorite(state, user, capsuleId);
                co_return envelope::noContent();
            });
        },
        {drogon::Delete});

    // ── AI 建议 / 推荐 ──────────────────────────────────────────────────────
    app.registerHandler(
        "/api/v1/capsule-suggestion",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                const auto body = requireJsonBody(req);
                std::optional<std::string> title;
                if (body["title"].isString())
                    title = body["title"].asString();
                co_return envelope::ok(co_await state->suggestion->suggest(title));
            });
        },
        {drogon::Post});
    app.registerHandler(
        "/api/v1/capsule-recommendations",
        [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
            co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
                int64_t count = 4;
                const auto raw = strParam(req, "count");
                if (raw)
                {
                    try
                    {
                        size_t pos = 0;
                        count = std::stoll(*raw, &pos);
                        if (pos != raw->size() || count < 3 || count > 8)
                            throw std::invalid_argument("range");
                    }
                    catch (...)
                    {
                        throw ApiError::validation("count 必须是 [3, 8] 范围内的整数",
                                                   "count");
                    }
                }
                const std::string locale = strParam(req, "locale").value_or("zh-CN");
                co_return envelope::ok(
                    co_await state->recommendation->getRecommendations(count, locale));
            });
        },
        {drogon::Get});
}
