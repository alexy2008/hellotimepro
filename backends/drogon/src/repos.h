#pragma once

#include <drogon/orm/DbClient.h>
#include <drogon/utils/coroutine.h>

#include <optional>
#include <string>
#include <vector>

#include "db.h"
#include "domain.h"

// 仓储层：手写参数化 SQL（`?` 占位，跨库差异由 Db 的值编码 + row_get 解码抹平）。
// 方法都接收当前执行器 `DbClientPtr`（连接池客户端或事务对象，事务是 DbClient 的
// 子类）——事务边界由 service 层决定，仓储自身不开事务。

enum class PlazaSort
{
    Hot,
    New
};

enum class PlazaFilter
{
    All,
    Opened,
    Unopened
};

namespace repo_users
{
using drogon::Task;
using drogon::orm::DbClientPtr;

Task<std::optional<User>> findByEmail(const Db &db, DbClientPtr exec, std::string email);
Task<std::optional<User>> findById(const Db &db, DbClientPtr exec, std::string id);
Task<bool> existsByEmail(const Db &db, DbClientPtr exec, std::string email);
Task<bool> existsByNickname(const Db &db, DbClientPtr exec, std::string nickname);
Task<void> insert(const Db &db, DbClientPtr exec, User user);
Task<void> updateProfile(const Db &db, DbClientPtr exec, std::string id,
                         std::string nickname, std::string avatarId, int64_t now);
Task<void> updatePassword(const Db &db, DbClientPtr exec, std::string id,
                          std::string passwordHash, int64_t now);
}  // namespace repo_users

namespace repo_capsules
{
using drogon::Task;
using drogon::orm::DbClientPtr;

Task<std::optional<CapsuleView>> findByCode(const Db &db, DbClientPtr exec, std::string code);
Task<std::optional<CapsuleView>> findById(const Db &db, DbClientPtr exec, std::string id);
Task<bool> existsByCode(const Db &db, DbClientPtr exec, std::string code);
Task<void> insert(const Db &db, DbClientPtr exec, Capsule capsule);
Task<void> remove(const Db &db, DbClientPtr exec, std::string id);
Task<void> incrementFavoriteCount(const Db &db, DbClientPtr exec, std::string id,
                                  int64_t now);
Task<void> decrementFavoriteCount(const Db &db, DbClientPtr exec, std::string id,
                                  int64_t now);
Task<int64_t> favoriteCountOf(const Db &db, DbClientPtr exec, std::string id);

Task<int64_t> countPlaza(const Db &db, DbClientPtr exec, PlazaFilter filter, int64_t now,
                         std::optional<std::string> search);
Task<std::vector<CapsuleView>> findPlazaPage(const Db &db, DbClientPtr exec,
                                             PlazaFilter filter, int64_t now,
                                             std::optional<std::string> search,
                                             PlazaSort sort,
                                             std::optional<std::string> viewerId,
                                             int64_t limit, int64_t offset);
Task<int64_t> countByOwner(const Db &db, DbClientPtr exec, std::string ownerId);
Task<std::vector<CapsuleView>> findByOwnerPage(const Db &db, DbClientPtr exec,
                                               std::string ownerId, int64_t limit,
                                               int64_t offset);
Task<int64_t> countFavoritesByUser(const Db &db, DbClientPtr exec, std::string userId);
Task<std::vector<CapsuleView>> findFavoritesPage(const Db &db, DbClientPtr exec,
                                                 std::string userId, int64_t limit,
                                                 int64_t offset);
}  // namespace repo_capsules

namespace repo_favorites
{
using drogon::Task;
using drogon::orm::DbClientPtr;

Task<std::optional<int64_t>> find(const Db &db, DbClientPtr exec, std::string userId,
                                  std::string capsuleId);
Task<bool> exists(const Db &db, DbClientPtr exec, std::string userId, std::string capsuleId);
// 幂等插入：已存在时不报错。返回是否真的插入了新行。
Task<bool> insertIgnore(const Db &db, DbClientPtr exec, std::string userId,
                        std::string capsuleId, int64_t now);
// 幂等删除：返回是否真的删除了行。
Task<bool> remove(const Db &db, DbClientPtr exec, std::string userId, std::string capsuleId);
Task<void> removeByCapsule(const Db &db, DbClientPtr exec, std::string capsuleId);
}  // namespace repo_favorites

namespace repo_refresh_tokens
{
using drogon::Task;
using drogon::orm::DbClientPtr;

// Postgres 路径加 FOR UPDATE 行锁，防止并发刷新双花；SQLite 单连接天然串行。
Task<std::optional<RefreshTokenRow>> findByTokenHashForUpdate(const Db &db, DbClientPtr exec,
                                                              std::string tokenHash);
Task<std::optional<RefreshTokenRow>> findByTokenHash(const Db &db, DbClientPtr exec,
                                                     std::string tokenHash);
Task<void> insert(const Db &db, DbClientPtr exec, RefreshTokenRow token);
Task<void> markRevoked(const Db &db, DbClientPtr exec, std::string id, int64_t now);
Task<void> revokeFamily(const Db &db, DbClientPtr exec, std::string familyId, int64_t now);
Task<void> revokeUser(const Db &db, DbClientPtr exec, std::string userId, int64_t now);
}  // namespace repo_refresh_tokens
