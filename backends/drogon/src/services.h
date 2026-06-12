#pragma once

#include <drogon/HttpRequest.h>
#include <drogon/utils/coroutine.h>
#include <json/json.h>

#include <memory>
#include <optional>
#include <string>

#include "app_state.h"
#include "domain.h"

// 业务服务层：注册/登录/刷新/登出/改密、资料、胶囊、广场、收藏。
// 事务模式：service 公共方法只开一次事务；业务异常先 rollback 再上抛
// （drogon Transaction 析构时默认提交）。refresh 的重用检测分支借助
// outcome 值"先提交家族吊销、再转 401"。

namespace auth_service
{
drogon::Task<Json::Value> registerUser(std::shared_ptr<AppState> state, Json::Value body);
drogon::Task<Json::Value> login(std::shared_ptr<AppState> state, Json::Value body);
drogon::Task<Json::Value> refresh(std::shared_ptr<AppState> state,
                                  std::optional<std::string> rawRefresh);
drogon::Task<void> logout(std::shared_ptr<AppState> state,
                          std::optional<std::string> rawRefresh);
drogon::Task<void> changePassword(std::shared_ptr<AppState> state, User user,
                                  Json::Value body);
}  // namespace auth_service

namespace user_service
{
drogon::Task<Json::Value> updateProfile(std::shared_ptr<AppState> state, User user,
                                        Json::Value body);
}  // namespace user_service

namespace capsule_service
{
drogon::Task<Json::Value> create(std::shared_ptr<AppState> state, User owner,
                                 Json::Value body);
drogon::Task<Json::Value> getByCode(std::shared_ptr<AppState> state, std::string code,
                                    std::optional<std::string> viewerId);
drogon::Task<Json::Value> getPlazaDetail(std::shared_ptr<AppState> state, std::string idRaw,
                                         std::optional<std::string> viewerId);
drogon::Task<void> deleteOwn(std::shared_ptr<AppState> state, User user, std::string idRaw);
std::string generateCode();
}  // namespace capsule_service

namespace plaza_service
{
drogon::Task<Json::Value> plazaList(std::shared_ptr<AppState> state, std::string sort,
                                    std::string filter, std::optional<std::string> q,
                                    int64_t page, int64_t pageSize,
                                    std::optional<std::string> viewerId);
drogon::Task<Json::Value> myCapsules(std::shared_ptr<AppState> state, User user,
                                     int64_t page, int64_t pageSize);
drogon::Task<Json::Value> myFavorites(std::shared_ptr<AppState> state, User user,
                                      int64_t page, int64_t pageSize);
}  // namespace plaza_service

namespace favorite_service
{
drogon::Task<Json::Value> addFavorite(std::shared_ptr<AppState> state, User user,
                                      std::optional<std::string> capsuleIdRaw);
drogon::Task<void> removeFavorite(std::shared_ptr<AppState> state, User user,
                                  std::string capsuleIdRaw);
}  // namespace favorite_service

// ── 鉴权上下文：从 Authorization 头解析 Bearer JWT 并加载当前用户 ───────────
namespace auth_context
{
// 匿名可访问端点：无/非法 token 返回 nullopt。
drogon::Task<std::optional<User>> optionalUser(std::shared_ptr<AppState> state,
                                               drogon::HttpRequestPtr req);
// 受保护端点：缺失/过期/非法 → UNAUTHORIZED。
drogon::Task<User> requiredUser(std::shared_ptr<AppState> state,
                                drogon::HttpRequestPtr req);
}  // namespace auth_context
