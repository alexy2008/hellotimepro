#include "repos.h"

using drogon::Task;
using drogon::orm::DbClientPtr;
using drogon::orm::Result;
using drogon::orm::Row;

namespace
{
User mapUser(const Row &row)
{
    User u;
    u.id = row_get::uuid(row, "id");
    u.email = row_get::str(row, "email");
    u.passwordHash = row_get::str(row, "password_hash");
    u.nickname = row_get::str(row, "nickname");
    u.avatarId = row_get::str(row, "avatar_id");
    u.createdAt = row_get::ts(row, "created_at");
    u.updatedAt = row_get::ts(row, "updated_at");
    return u;
}

// 联表查询的公共列：胶囊全列 + 创建者摘要。
constexpr const char *kViewColumns =
    "c.id, c.owner_id, c.code, c.title, c.content, c.open_at, c.in_plaza, "
    "c.favorite_count, c.created_at, c.updated_at, "
    "u.nickname AS owner_nickname, u.avatar_id AS owner_avatar_id";

CapsuleView mapView(const Row &row, bool favoritedColumn, bool favoritedAtColumn)
{
    CapsuleView v;
    v.capsule.id = row_get::uuid(row, "id");
    v.capsule.ownerId = row_get::uuid(row, "owner_id");
    v.capsule.code = row_get::str(row, "code");
    v.capsule.title = row_get::str(row, "title");
    v.capsule.content = row_get::str(row, "content");
    v.capsule.openAt = row_get::ts(row, "open_at");
    v.capsule.inPlaza = row_get::boolean(row, "in_plaza");
    v.capsule.favoriteCount = row_get::i64(row, "favorite_count");
    v.capsule.createdAt = row_get::ts(row, "created_at");
    v.capsule.updatedAt = row_get::ts(row, "updated_at");
    v.ownerNickname = row_get::str(row, "owner_nickname");
    v.ownerAvatarId = row_get::str(row, "owner_avatar_id");
    v.favoritedByMe = favoritedColumn ? row_get::boolean(row, "favorited_by_me") : false;
    if (favoritedAtColumn)
        v.favoritedAt = row_get::tsOpt(row, "favorited_at");
    return v;
}

RefreshTokenRow mapRefresh(const Row &row)
{
    RefreshTokenRow t;
    t.id = row_get::uuid(row, "id");
    t.userId = row_get::uuid(row, "user_id");
    t.tokenHash = row_get::str(row, "token_hash");
    t.familyId = row_get::uuid(row, "family_id");
    t.expiresAt = row_get::ts(row, "expires_at");
    t.createdAt = row_get::ts(row, "created_at");
    t.revokedAt = row_get::tsOpt(row, "revoked_at");
    return t;
}
}  // namespace

// ── users ───────────────────────────────────────────────────────────────────

namespace repo_users
{
Task<std::optional<User>> findByEmail(const Db &db, DbClientPtr exec, std::string email)
{
    auto r = co_await Db::query(exec, "SELECT * FROM users WHERE email = ?", {email});
    if (r.empty())
        co_return std::nullopt;
    co_return mapUser(r[0]);
}

Task<std::optional<User>> findById(const Db &db, DbClientPtr exec, std::string id)
{
    auto r =
        co_await Db::query(exec, "SELECT * FROM users WHERE id = ?", {db.uuidValue(id)});
    if (r.empty())
        co_return std::nullopt;
    co_return mapUser(r[0]);
}

Task<bool> existsByEmail(const Db &db, DbClientPtr exec, std::string email)
{
    auto r =
        co_await Db::query(exec, "SELECT 1 FROM users WHERE email = ? LIMIT 1", {email});
    co_return !r.empty();
}

Task<bool> existsByNickname(const Db &db, DbClientPtr exec, std::string nickname)
{
    auto r = co_await Db::query(exec, "SELECT 1 FROM users WHERE nickname = ? LIMIT 1",
                                {nickname});
    co_return !r.empty();
}

Task<void> insert(const Db &db, DbClientPtr exec, User user)
{
    co_await Db::query(
        exec,
        "INSERT INTO users (id, email, password_hash, nickname, avatar_id, created_at, "
        "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        {db.uuidValue(user.id), user.email, user.passwordHash, user.nickname, user.avatarId,
         db.tsValue(user.createdAt), db.tsValue(user.updatedAt)});
}

Task<void> updateProfile(const Db &db, DbClientPtr exec, std::string id,
                         std::string nickname, std::string avatarId, int64_t now)
{
    co_await Db::query(
        exec, "UPDATE users SET nickname = ?, avatar_id = ?, updated_at = ? WHERE id = ?",
        {nickname, avatarId, db.tsValue(now), db.uuidValue(id)});
}

Task<void> updatePassword(const Db &db, DbClientPtr exec, std::string id,
                          std::string passwordHash, int64_t now)
{
    co_await Db::query(exec,
                       "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                       {passwordHash, db.tsValue(now), db.uuidValue(id)});
}
}  // namespace repo_users

// ── capsules ────────────────────────────────────────────────────────────────

namespace repo_capsules
{
Task<std::optional<CapsuleView>> findByCode(const Db &db, DbClientPtr exec, std::string code)
{
    const std::string sql = std::string("SELECT ") + kViewColumns +
                            " FROM capsules c JOIN users u ON u.id = c.owner_id "
                            "WHERE c.code = ?";
    auto r = co_await Db::query(exec, sql, {code});
    if (r.empty())
        co_return std::nullopt;
    co_return mapView(r[0], false, false);
}

Task<std::optional<CapsuleView>> findById(const Db &db, DbClientPtr exec, std::string id)
{
    const std::string sql = std::string("SELECT ") + kViewColumns +
                            " FROM capsules c JOIN users u ON u.id = c.owner_id "
                            "WHERE c.id = ?";
    auto r = co_await Db::query(exec, sql, {db.uuidValue(id)});
    if (r.empty())
        co_return std::nullopt;
    co_return mapView(r[0], false, false);
}

Task<bool> existsByCode(const Db &db, DbClientPtr exec, std::string code)
{
    auto r =
        co_await Db::query(exec, "SELECT 1 FROM capsules WHERE code = ? LIMIT 1", {code});
    co_return !r.empty();
}

Task<void> insert(const Db &db, DbClientPtr exec, Capsule c)
{
    co_await Db::query(
        exec,
        "INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza, "
        "favorite_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        {db.uuidValue(c.id), db.uuidValue(c.ownerId), c.code, c.title, c.content,
         db.tsValue(c.openAt), db.boolValue(c.inPlaza), std::to_string(c.favoriteCount),
         db.tsValue(c.createdAt), db.tsValue(c.updatedAt)});
}

Task<void> remove(const Db &db, DbClientPtr exec, std::string id)
{
    co_await Db::query(exec, "DELETE FROM capsules WHERE id = ?", {db.uuidValue(id)});
}

Task<void> incrementFavoriteCount(const Db &db, DbClientPtr exec, std::string id,
                                  int64_t now)
{
    co_await Db::query(exec,
                       "UPDATE capsules SET favorite_count = favorite_count + 1, "
                       "updated_at = ? WHERE id = ?",
                       {db.tsValue(now), db.uuidValue(id)});
}

Task<void> decrementFavoriteCount(const Db &db, DbClientPtr exec, std::string id,
                                  int64_t now)
{
    co_await Db::query(exec,
                       "UPDATE capsules SET favorite_count = favorite_count - 1, "
                       "updated_at = ? WHERE id = ? AND favorite_count > 0",
                       {db.tsValue(now), db.uuidValue(id)});
}

Task<int64_t> favoriteCountOf(const Db &db, DbClientPtr exec, std::string id)
{
    auto r = co_await Db::query(exec, "SELECT favorite_count FROM capsules WHERE id = ?",
                                {db.uuidValue(id)});
    if (r.empty())
        co_return 0;
    co_return row_get::i64(r[0], "favorite_count");
}

// ── 广场 ─────────────────────────────────────────────────────────────────────

namespace
{
// WHERE 子句公共部分：in_plaza + filter + q。
void plazaConditions(const Db &db, std::string &sql, std::vector<std::string> &params,
                     PlazaFilter filter, int64_t now,
                     const std::optional<std::string> &search)
{
    sql += " WHERE c.in_plaza = ?";
    params.push_back(db.boolValue(true));
    if (filter == PlazaFilter::Opened)
    {
        sql += " AND c.open_at <= ?";
        params.push_back(db.tsValue(now));
    }
    else if (filter == PlazaFilter::Unopened)
    {
        sql += " AND c.open_at > ?";
        params.push_back(db.tsValue(now));
    }
    if (search)
    {
        const std::string pattern = "%" + *search + "%";
        sql += " AND (lower(c.title) LIKE ? OR lower(u.nickname) LIKE ?)";
        params.push_back(pattern);
        params.push_back(pattern);
    }
}
}  // namespace

Task<int64_t> countPlaza(const Db &db, DbClientPtr exec, PlazaFilter filter, int64_t now,
                         std::optional<std::string> search)
{
    std::string sql =
        "SELECT COUNT(*) AS total FROM capsules c JOIN users u ON u.id = c.owner_id";
    std::vector<std::string> params;
    plazaConditions(db, sql, params, filter, now, search);
    auto r = co_await Db::query(exec, sql, params);
    if (r.empty())
        co_return 0;
    co_return row_get::i64(r[0], "total");
}

Task<std::vector<CapsuleView>> findPlazaPage(const Db &db, DbClientPtr exec,
                                             PlazaFilter filter, int64_t now,
                                             std::optional<std::string> search,
                                             PlazaSort sort,
                                             std::optional<std::string> viewerId,
                                             int64_t limit, int64_t offset)
{
    std::string sql = std::string("SELECT ") + kViewColumns + ", ";
    std::vector<std::string> params;
    if (viewerId)
    {
        sql += "(fv.user_id IS NOT NULL) AS favorited_by_me "
               "FROM capsules c JOIN users u ON u.id = c.owner_id "
               "LEFT JOIN favorites fv ON fv.capsule_id = c.id AND fv.user_id = ?";
        params.push_back(db.uuidValue(*viewerId));
    }
    else
    {
        sql += "(1 = 0) AS favorited_by_me "
               "FROM capsules c JOIN users u ON u.id = c.owner_id";
    }
    plazaConditions(db, sql, params, filter, now, search);
    if (sort == PlazaSort::Hot)
        sql += " ORDER BY c.favorite_count DESC, c.created_at DESC";
    else
        sql += " ORDER BY c.created_at DESC";
    // LIMIT/OFFSET 为服务端计算的整数，直接内联（见 db.h 说明）。
    sql += " LIMIT " + std::to_string(limit) + " OFFSET " + std::to_string(offset);

    auto r = co_await Db::query(exec, sql, params);
    std::vector<CapsuleView> views;
    views.reserve(r.size());
    for (const auto &row : r)
        views.push_back(mapView(row, true, false));
    co_return views;
}

Task<int64_t> countByOwner(const Db &db, DbClientPtr exec, std::string ownerId)
{
    auto r = co_await Db::query(exec,
                                "SELECT COUNT(*) AS total FROM capsules WHERE owner_id = ?",
                                {db.uuidValue(ownerId)});
    if (r.empty())
        co_return 0;
    co_return row_get::i64(r[0], "total");
}

Task<std::vector<CapsuleView>> findByOwnerPage(const Db &db, DbClientPtr exec,
                                               std::string ownerId, int64_t limit,
                                               int64_t offset)
{
    const std::string sql = std::string("SELECT ") + kViewColumns +
                            " FROM capsules c JOIN users u ON u.id = c.owner_id "
                            "WHERE c.owner_id = ? ORDER BY c.created_at DESC LIMIT " +
                            std::to_string(limit) + " OFFSET " + std::to_string(offset);
    auto r = co_await Db::query(exec, sql, {db.uuidValue(ownerId)});
    std::vector<CapsuleView> views;
    views.reserve(r.size());
    for (const auto &row : r)
        views.push_back(mapView(row, false, false));
    co_return views;
}

Task<int64_t> countFavoritesByUser(const Db &db, DbClientPtr exec, std::string userId)
{
    auto r = co_await Db::query(exec,
                                "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?",
                                {db.uuidValue(userId)});
    if (r.empty())
        co_return 0;
    co_return row_get::i64(r[0], "total");
}

Task<std::vector<CapsuleView>> findFavoritesPage(const Db &db, DbClientPtr exec,
                                                 std::string userId, int64_t limit,
                                                 int64_t offset)
{
    const std::string sql = std::string("SELECT ") + kViewColumns +
                            ", fv.created_at AS favorited_at "
                            "FROM favorites fv JOIN capsules c ON c.id = fv.capsule_id "
                            "JOIN users u ON u.id = c.owner_id "
                            "WHERE fv.user_id = ? ORDER BY fv.created_at DESC LIMIT " +
                            std::to_string(limit) + " OFFSET " + std::to_string(offset);
    auto r = co_await Db::query(exec, sql, {db.uuidValue(userId)});
    std::vector<CapsuleView> views;
    views.reserve(r.size());
    for (const auto &row : r)
    {
        auto view = mapView(row, false, true);
        view.favoritedByMe = true;
        views.push_back(std::move(view));
    }
    co_return views;
}
}  // namespace repo_capsules

// ── favorites ───────────────────────────────────────────────────────────────

namespace repo_favorites
{
Task<std::optional<int64_t>> find(const Db &db, DbClientPtr exec, std::string userId,
                                  std::string capsuleId)
{
    auto r = co_await Db::query(
        exec, "SELECT created_at FROM favorites WHERE user_id = ? AND capsule_id = ?",
        {db.uuidValue(userId), db.uuidValue(capsuleId)});
    if (r.empty())
        co_return std::nullopt;
    co_return row_get::ts(r[0], "created_at");
}

Task<bool> exists(const Db &db, DbClientPtr exec, std::string userId, std::string capsuleId)
{
    co_return (co_await find(db, exec, userId, capsuleId)).has_value();
}

Task<bool> insertIgnore(const Db &db, DbClientPtr exec, std::string userId,
                        std::string capsuleId, int64_t now)
{
    // PG / SQLite（≥3.35）的 UPSERT + RETURNING 语法一致。
    auto r = co_await Db::query(
        exec,
        "INSERT INTO favorites (user_id, capsule_id, created_at) VALUES (?, ?, ?) "
        "ON CONFLICT (user_id, capsule_id) DO NOTHING RETURNING created_at",
        {db.uuidValue(userId), db.uuidValue(capsuleId), db.tsValue(now)});
    co_return !r.empty();
}

Task<bool> remove(const Db &db, DbClientPtr exec, std::string userId, std::string capsuleId)
{
    auto r = co_await Db::query(
        exec,
        "DELETE FROM favorites WHERE user_id = ? AND capsule_id = ? RETURNING created_at",
        {db.uuidValue(userId), db.uuidValue(capsuleId)});
    co_return !r.empty();
}

Task<void> removeByCapsule(const Db &db, DbClientPtr exec, std::string capsuleId)
{
    co_await Db::query(exec, "DELETE FROM favorites WHERE capsule_id = ?",
                       {db.uuidValue(capsuleId)});
}
}  // namespace repo_favorites

// ── refresh_tokens ──────────────────────────────────────────────────────────

namespace repo_refresh_tokens
{
Task<std::optional<RefreshTokenRow>> findByTokenHashForUpdate(const Db &db, DbClientPtr exec,
                                                              std::string tokenHash)
{
    std::string sql = "SELECT * FROM refresh_tokens WHERE token_hash = ?";
    if (!db.isSqlite())
        sql += " FOR UPDATE";
    auto r = co_await Db::query(exec, sql, {tokenHash});
    if (r.empty())
        co_return std::nullopt;
    co_return mapRefresh(r[0]);
}

Task<std::optional<RefreshTokenRow>> findByTokenHash(const Db &db, DbClientPtr exec,
                                                     std::string tokenHash)
{
    auto r = co_await Db::query(exec, "SELECT * FROM refresh_tokens WHERE token_hash = ?",
                                {tokenHash});
    if (r.empty())
        co_return std::nullopt;
    co_return mapRefresh(r[0]);
}

Task<void> insert(const Db &db, DbClientPtr exec, RefreshTokenRow token)
{
    co_await Db::query(
        exec,
        "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, "
        "created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
        {db.uuidValue(token.id), db.uuidValue(token.userId), token.tokenHash,
         db.uuidValue(token.familyId), db.tsValue(token.expiresAt),
         db.tsValue(token.createdAt)});
}

Task<void> markRevoked(const Db &db, DbClientPtr exec, std::string id, int64_t now)
{
    co_await Db::query(
        exec, "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
        {db.tsValue(now), db.uuidValue(id)});
}

Task<void> revokeFamily(const Db &db, DbClientPtr exec, std::string familyId, int64_t now)
{
    co_await Db::query(exec,
                       "UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND "
                       "revoked_at IS NULL",
                       {db.tsValue(now), db.uuidValue(familyId)});
}

Task<void> revokeUser(const Db &db, DbClientPtr exec, std::string userId, int64_t now)
{
    co_await Db::query(exec,
                       "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND "
                       "revoked_at IS NULL",
                       {db.tsValue(now), db.uuidValue(userId)});
}
}  // namespace repo_refresh_tokens
