#include "services.h"

#include <algorithm>

#include "api_error.h"
#include "iso_date.h"
#include "mapper.h"
#include "repos.h"
#include "security.h"
#include "validation.h"

using drogon::Task;
using drogon::orm::DbClientPtr;

namespace
{
// 请求体字段读取：缺失/null → nullopt；存在但类型不符 → 422（对齐其它栈的解码层行为）。
std::optional<std::string> optStr(const Json::Value &body, const char *key)
{
    if (!body.isMember(key) || body[key].isNull())
        return std::nullopt;
    if (!body[key].isString())
        throw ApiError::invalidBody();
    return body[key].asString();
}

std::optional<bool> optBool(const Json::Value &body, const char *key)
{
    if (!body.isMember(key) || body[key].isNull())
        return std::nullopt;
    if (!body[key].isBool())
        throw ApiError::invalidBody();
    return body[key].asBool();
}

// 在当前事务内签发 access + refresh 对，并落库 refresh token 行。
Task<Json::Value> issueTokenPair(std::shared_ptr<AppState> state, DbClientPtr exec,
                                 User user, std::optional<std::string> familyId)
{
    const int64_t now = iso_date::now();
    const std::string access =
        security::createAccessToken(state->config, user, now / 1000000);
    const std::string refresh = security::generateRefreshToken();
    RefreshTokenRow row;
    row.id = newUuid();
    row.userId = user.id;
    row.tokenHash = security::hashRefreshToken(refresh);
    row.familyId = familyId.value_or(newUuid());
    row.expiresAt = iso_date::addSeconds(now, state->config.refreshTokenTtlSeconds);
    row.createdAt = now;
    co_await repo_refresh_tokens::insert(*state->db, exec, row);

    Json::Value out(Json::objectValue);
    out["accessToken"] = access;
    out["refreshToken"] = refresh;
    out["accessTokenExpiresIn"] = state->config.accessTokenTtlSeconds;
    out["refreshTokenExpiresIn"] = state->config.refreshTokenTtlSeconds;
    out["user"] = mapper::user(user);
    co_return out;
}

std::string toLower(std::string s)
{
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    return s;
}

std::string toUpper(std::string s)
{
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return std::toupper(c); });
    return s;
}
}  // namespace

// ── auth ────────────────────────────────────────────────────────────────────

namespace auth_service
{
Task<Json::Value> registerUser(std::shared_ptr<AppState> state, Json::Value body)
{
    const std::string email = toLower(validation::email(optStr(body, "email")));
    const std::string rawPassword = validation::password(optStr(body, "password"), "password");
    const std::string nickname = validation::nickname(optStr(body, "nickname"));
    const std::string avatarId = validation::avatarFormat(optStr(body, "avatarId"));
    if (!state->avatars->exists(avatarId))
        throw ApiError::validation("头像 ID 不存在", "avatarId");
    const std::string passwordHash = security::hashPassword(rawPassword);

    auto trans = co_await state->db->transaction();
    Json::Value result;
    try
    {
        if (co_await repo_users::existsByEmail(*state->db, trans, email))
            throw ApiError::conflict("邮箱已被注册", "email");
        if (co_await repo_users::existsByNickname(*state->db, trans, nickname))
            throw ApiError::conflict("昵称已被使用", "nickname");
        const int64_t now = iso_date::now();
        User user;
        user.id = newUuid();
        user.email = email;
        user.passwordHash = passwordHash;
        user.nickname = nickname;
        user.avatarId = avatarId;
        user.createdAt = now;
        user.updatedAt = now;
        co_await repo_users::insert(*state->db, trans, user);
        result = co_await issueTokenPair(state, trans, user, std::nullopt);
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
    co_return result;
}

Task<Json::Value> login(std::shared_ptr<AppState> state, Json::Value body)
{
    const std::string email = toLower(validation::email(optStr(body, "email")));
    const std::string password =
        validation::requireNonBlank(optStr(body, "password"), "password");
    if (state->rateLimiter->isLimited(email))
        throw ApiError::rateLimited("操作过于频繁，请稍后再试");

    std::optional<Json::Value> tokens;
    {
        auto trans = co_await state->db->transaction();
        try
        {
            const auto user = co_await repo_users::findByEmail(*state->db, trans, email);
            if (user && security::verifyPassword(password, user->passwordHash))
                tokens = co_await issueTokenPair(state, trans, *user, std::nullopt);
        }
        catch (...)
        {
            trans->rollback();
            throw;
        }
        co_await Db::awaitCommit(std::move(trans));
    }
    if (!tokens)
    {
        state->rateLimiter->recordFailure(email);
        throw ApiError::unauthorized("邮箱或密码错误");
    }
    co_return *tokens;
}

namespace
{
enum class RefreshOutcome
{
    Success,
    Invalid,
    Reused
};
}

Task<Json::Value> refresh(std::shared_ptr<AppState> state,
                          std::optional<std::string> rawRefresh)
{
    const std::string raw = validation::requireNonBlank(rawRefresh, "refreshToken");
    const std::string tokenHash = security::hashRefreshToken(raw);

    // 关键：重用检测分支必须提交 family 吊销后再抛 401——事务内不抛业务异常，
    // 用 outcome 区分；事务对象析构（作用域结束）即提交，之后再转错误。
    RefreshOutcome outcome = RefreshOutcome::Invalid;
    Json::Value tokens;
    {
        auto trans = co_await state->db->transaction();
        try
        {
            const auto row = co_await repo_refresh_tokens::findByTokenHashForUpdate(
                *state->db, trans, tokenHash);
            const int64_t now = iso_date::now();
            if (!row || row->expiresAt <= now)
                outcome = RefreshOutcome::Invalid;
            else if (row->revokedAt)
            {
                co_await repo_refresh_tokens::revokeFamily(*state->db, trans, row->familyId,
                                                           now);
                outcome = RefreshOutcome::Reused;
            }
            else
            {
                const auto user =
                    co_await repo_users::findById(*state->db, trans, row->userId);
                if (!user)
                    outcome = RefreshOutcome::Invalid;
                else
                {
                    co_await repo_refresh_tokens::markRevoked(*state->db, trans, row->id,
                                                              now);
                    tokens = co_await issueTokenPair(state, trans, *user, row->familyId);
                    outcome = RefreshOutcome::Success;
                }
            }
        }
        catch (...)
        {
            trans->rollback();
            throw;
        }
        // 重用检测的家族吊销必须先“提交完成”，再把 outcome 转成 401。
        co_await Db::awaitCommit(std::move(trans));
    }
    switch (outcome)
    {
        case RefreshOutcome::Success:
            co_return tokens;
        case RefreshOutcome::Reused:
            throw ApiError::unauthorized("refresh token 已失效");
        default:
            throw ApiError::unauthorized("refresh token 无效");
    }
}

Task<void> logout(std::shared_ptr<AppState> state, std::optional<std::string> rawRefresh)
{
    if (!rawRefresh || rawRefresh->empty())
        co_return;
    const std::string hash = security::hashRefreshToken(*rawRefresh);
    auto trans = co_await state->db->transaction();
    try
    {
        const auto row =
            co_await repo_refresh_tokens::findByTokenHash(*state->db, trans, hash);
        if (row && !row->revokedAt)
            co_await repo_refresh_tokens::markRevoked(*state->db, trans, row->id,
                                                      iso_date::now());
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
}

Task<void> changePassword(std::shared_ptr<AppState> state, User user, Json::Value body)
{
    const std::string current =
        validation::requireNonBlank(optStr(body, "currentPassword"), "currentPassword");
    const std::string newPassword =
        validation::password(optStr(body, "newPassword"), "newPassword");
    if (!security::verifyPassword(current, user.passwordHash))
        throw ApiError::unauthorized("当前密码错误");
    const std::string newHash = security::hashPassword(newPassword);

    auto trans = co_await state->db->transaction();
    try
    {
        const int64_t now = iso_date::now();
        co_await repo_users::updatePassword(*state->db, trans, user.id, newHash, now);
        // 改密后吊销该用户所有 refresh token（含当前会话）。
        co_await repo_refresh_tokens::revokeUser(*state->db, trans, user.id, now);
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
}
}  // namespace auth_service

// ── user ────────────────────────────────────────────────────────────────────

namespace user_service
{
Task<Json::Value> updateProfile(std::shared_ptr<AppState> state, User user, Json::Value body)
{
    const auto nicknameOpt = optStr(body, "nickname");
    const auto avatarOpt = optStr(body, "avatarId");
    if (!nicknameOpt && !avatarOpt)
        throw ApiError::validation("至少提供 nickname 或 avatarId 之一", "body");
    const std::string nickname =
        nicknameOpt ? validation::nickname(nicknameOpt) : user.nickname;
    const std::string avatarId =
        avatarOpt ? validation::avatarFormat(avatarOpt) : user.avatarId;
    if (avatarOpt && !state->avatars->exists(avatarId))
        throw ApiError::validation("头像 ID 不存在", "avatarId");

    auto trans = co_await state->db->transaction();
    Json::Value result;
    try
    {
        if (nickname != user.nickname &&
            co_await repo_users::existsByNickname(*state->db, trans, nickname))
            throw ApiError::conflict("昵称已被使用", "nickname");
        const int64_t now = iso_date::now();
        co_await repo_users::updateProfile(*state->db, trans, user.id, nickname, avatarId,
                                           now);
        User updated = user;
        updated.nickname = nickname;
        updated.avatarId = avatarId;
        updated.updatedAt = now;
        result = mapper::user(updated);
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
    co_return result;
}
}  // namespace user_service

// ── capsule ─────────────────────────────────────────────────────────────────

namespace capsule_service
{
namespace
{
constexpr const char *kCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

Task<bool> isFavorited(std::shared_ptr<AppState> state, DbClientPtr exec,
                       const std::optional<std::string> &viewerId,
                       const std::string &capsuleId)
{
    if (!viewerId)
        co_return false;
    co_return co_await repo_favorites::exists(*state->db, exec, *viewerId, capsuleId);
}
}  // namespace

std::string generateCode()
{
    std::string code;
    code.reserve(8);
    for (int i = 0; i < 8; ++i)
        code += kCodeAlphabet[arc4random_uniform(36)];
    return code;
}

Task<Json::Value> create(std::shared_ptr<AppState> state, User owner, Json::Value body)
{
    const std::string title = validation::title(optStr(body, "title"));
    const std::string content = validation::content(optStr(body, "content"));
    const int64_t openAt = validation::openAt(optStr(body, "openAt"));
    const int64_t now = iso_date::now();
    if (openAt < iso_date::addSeconds(now, 60))
        throw ApiError::validation("openAt 必须晚于当前时间 60 秒以上", "openAt");
    if (openAt > iso_date::addYearsUtc(now, 10))
        throw ApiError::validation("openAt 不得超出当前时间 10 年", "openAt");
    const bool inPlaza = optBool(body, "inPlaza").value_or(true);

    auto trans = co_await state->db->transaction();
    Json::Value result;
    try
    {
        std::string code;
        for (int i = 0; i < 5 && code.empty(); ++i)
        {
            const std::string candidate = generateCode();
            if (!co_await repo_capsules::existsByCode(*state->db, trans, candidate))
                code = candidate;
        }
        if (code.empty())
            throw ApiError::internal("生成唯一码失败");

        Capsule capsule;
        capsule.id = newUuid();
        capsule.ownerId = owner.id;
        capsule.code = code;
        capsule.title = title;
        capsule.content = content;
        capsule.openAt = openAt;
        capsule.inPlaza = inPlaza;
        capsule.favoriteCount = 0;
        capsule.createdAt = now;
        capsule.updatedAt = now;
        co_await repo_capsules::insert(*state->db, trans, capsule);

        CapsuleView view;
        view.capsule = capsule;
        view.ownerNickname = owner.nickname;
        view.ownerAvatarId = owner.avatarId;
        result = mapper::detail(view, false, iso_date::now());
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
    co_return result;
}

// 按 8 位码查询：凭码即可见（包括 inPlaza=false），大小写不敏感。
Task<Json::Value> getByCode(std::shared_ptr<AppState> state, std::string code,
                            std::optional<std::string> viewerId)
{
    validation::code(code);
    const std::string upper = toUpper(code);
    auto client = state->db->client();
    const auto view = co_await repo_capsules::findByCode(*state->db, client, upper);
    if (!view)
        throw ApiError::notFound("胶囊不存在");
    const bool favorited = co_await isFavorited(state, client, viewerId, view->capsule.id);
    co_return mapper::detail(*view, favorited, iso_date::now());
}

// 广场详情：仅 inPlaza=true；非法 UUID / 不在广场 → 404。
Task<Json::Value> getPlazaDetail(std::shared_ptr<AppState> state, std::string idRaw,
                                 std::optional<std::string> viewerId)
{
    const auto id = normalizeUuid(idRaw);
    if (!id)
        throw ApiError::notFound("胶囊不存在");
    auto client = state->db->client();
    const auto view = co_await repo_capsules::findById(*state->db, client, *id);
    if (!view || !view->capsule.inPlaza)
        throw ApiError::notFound("胶囊不存在");
    const bool favorited = co_await isFavorited(state, client, viewerId, view->capsule.id);
    co_return mapper::detail(*view, favorited, iso_date::now());
}

// 删除自己的胶囊（无论是否到期）；连同收藏关系一起删。
Task<void> deleteOwn(std::shared_ptr<AppState> state, User user, std::string idRaw)
{
    const auto id = normalizeUuid(idRaw);
    if (!id)
        throw ApiError::notFound("胶囊不存在");
    auto trans = co_await state->db->transaction();
    try
    {
        const auto view = co_await repo_capsules::findById(*state->db, trans, *id);
        if (!view)
            throw ApiError::notFound("胶囊不存在");
        if (view->capsule.ownerId != user.id)
            throw ApiError::forbidden("无权删除他人胶囊");
        co_await repo_favorites::removeByCapsule(*state->db, trans, *id);
        co_await repo_capsules::remove(*state->db, trans, *id);
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
}
}  // namespace capsule_service

// ── plaza ───────────────────────────────────────────────────────────────────

namespace plaza_service
{
Task<Json::Value> plazaList(std::shared_ptr<AppState> state, std::string sort,
                            std::string filter, std::optional<std::string> q, int64_t page,
                            int64_t pageSize, std::optional<std::string> viewerId)
{
    validation::page(page, pageSize);
    PlazaSort plazaSort;
    if (sort == "hot")
        plazaSort = PlazaSort::Hot;
    else if (sort == "new")
        plazaSort = PlazaSort::New;
    else
        throw ApiError::validation("sort 仅支持 hot/new", "sort");
    PlazaFilter plazaFilter;
    if (filter == "all")
        plazaFilter = PlazaFilter::All;
    else if (filter == "opened")
        plazaFilter = PlazaFilter::Opened;
    else if (filter == "unopened")
        plazaFilter = PlazaFilter::Unopened;
    else
        throw ApiError::validation("filter 仅支持 all/opened/unopened", "filter");

    // q：trim 后为空视为未传；超 50 → 422；大小写不敏感子串匹配。
    std::optional<std::string> search;
    if (q)
    {
        std::string s = *q;
        const auto begin = s.find_first_not_of(" \t\r\n");
        const auto end = s.find_last_not_of(" \t\r\n");
        s = begin == std::string::npos ? "" : s.substr(begin, end - begin + 1);
        if (!s.empty())
        {
            if (validation::codepointCount(s) > 50)
                throw ApiError::validation("q 长度不得超过 50", "q");
            // 仅 ASCII 小写化（DB 端 lower() 行为跨库一致也仅 ASCII）。
            std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) {
                return c < 0x80 ? std::tolower(c) : c;
            });
            search = s;
        }
    }
    const int64_t now = iso_date::now();

    auto client = state->db->client();
    const int64_t total =
        co_await repo_capsules::countPlaza(*state->db, client, plazaFilter, now, search);
    const auto rows = co_await repo_capsules::findPlazaPage(
        *state->db, client, plazaFilter, now, search, plazaSort, viewerId, pageSize,
        (page - 1) * pageSize);
    Json::Value items(Json::arrayValue);
    for (const auto &v : rows)
        items.append(mapper::listItem(v, now));
    co_return mapper::paginated(std::move(items), total, page, pageSize);
}

Task<Json::Value> myCapsules(std::shared_ptr<AppState> state, User user, int64_t page,
                             int64_t pageSize)
{
    validation::page(page, pageSize);
    const int64_t now = iso_date::now();
    auto client = state->db->client();
    const int64_t total = co_await repo_capsules::countByOwner(*state->db, client, user.id);
    const auto rows = co_await repo_capsules::findByOwnerPage(*state->db, client, user.id,
                                                              pageSize, (page - 1) * pageSize);
    Json::Value items(Json::arrayValue);
    for (const auto &v : rows)
        items.append(mapper::listItem(v, now));
    co_return mapper::paginated(std::move(items), total, page, pageSize);
}

Task<Json::Value> myFavorites(std::shared_ptr<AppState> state, User user, int64_t page,
                              int64_t pageSize)
{
    validation::page(page, pageSize);
    const int64_t now = iso_date::now();
    auto client = state->db->client();
    const int64_t total =
        co_await repo_capsules::countFavoritesByUser(*state->db, client, user.id);
    const auto rows = co_await repo_capsules::findFavoritesPage(
        *state->db, client, user.id, pageSize, (page - 1) * pageSize);
    Json::Value items(Json::arrayValue);
    for (const auto &v : rows)
        items.append(mapper::listItem(v, now));
    co_return mapper::paginated(std::move(items), total, page, pageSize);
}
}  // namespace plaza_service

// ── favorite ────────────────────────────────────────────────────────────────

namespace favorite_service
{
Task<Json::Value> addFavorite(std::shared_ptr<AppState> state, User user,
                              std::optional<std::string> capsuleIdRaw)
{
    const auto capsuleId = capsuleIdRaw ? normalizeUuid(*capsuleIdRaw) : std::nullopt;
    if (!capsuleId)
        throw ApiError::notFound("胶囊不存在");

    auto trans = co_await state->db->transaction();
    Json::Value result;
    try
    {
        const auto view = co_await repo_capsules::findById(*state->db, trans, *capsuleId);
        if (!view || !view->capsule.inPlaza)
            throw ApiError::notFound("胶囊不存在");
        if (view->capsule.ownerId == user.id)
            throw ApiError::badRequest("不能收藏自己创建的胶囊");

        const int64_t now = iso_date::now();
        const bool inserted = co_await repo_favorites::insertIgnore(
            *state->db, trans, user.id, view->capsule.id, now);
        int64_t favoritedAt = now;
        if (inserted)
            co_await repo_capsules::incrementFavoriteCount(*state->db, trans,
                                                           view->capsule.id, now);
        else
        {
            // 幂等：已收藏时返回原收藏时间，计数不变。
            const auto existing =
                co_await repo_favorites::find(*state->db, trans, user.id, view->capsule.id);
            favoritedAt = existing.value_or(now);
        }
        const int64_t count =
            co_await repo_capsules::favoriteCountOf(*state->db, trans, view->capsule.id);
        result["capsuleId"] = view->capsule.id;
        result["favoriteCount"] = Json::Int64(count);
        result["favoritedAt"] = iso_date::jsonString(favoritedAt);
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
    co_return result;
}

// 取消收藏幂等：胶囊不存在/格式非法/原本未收藏都返回成功（204）。
Task<void> removeFavorite(std::shared_ptr<AppState> state, User user, std::string capsuleIdRaw)
{
    const auto capsuleId = normalizeUuid(capsuleIdRaw);
    if (!capsuleId)
        co_return;
    auto trans = co_await state->db->transaction();
    try
    {
        const bool deleted =
            co_await repo_favorites::remove(*state->db, trans, user.id, *capsuleId);
        if (deleted)
            co_await repo_capsules::decrementFavoriteCount(*state->db, trans, *capsuleId,
                                                           iso_date::now());
    }
    catch (...)
    {
        trans->rollback();
        throw;
    }
    co_await Db::awaitCommit(std::move(trans));
}
}  // namespace favorite_service

// ── auth context ────────────────────────────────────────────────────────────

namespace auth_context
{
namespace
{
std::optional<std::string> parseBearer(const drogon::HttpRequestPtr &req)
{
    std::string raw = req->getHeader("authorization");
    const auto begin = raw.find_first_not_of(" \t");
    if (begin == std::string::npos)
        return std::nullopt;
    const auto end = raw.find_last_not_of(" \t");
    raw = raw.substr(begin, end - begin + 1);
    const auto space = raw.find(' ');
    if (space == std::string::npos)
        return std::nullopt;
    std::string scheme = raw.substr(0, space);
    std::transform(scheme.begin(), scheme.end(), scheme.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    if (scheme != "bearer")
        return std::nullopt;
    std::string token = raw.substr(space + 1);
    const auto tBegin = token.find_first_not_of(" \t");
    if (tBegin == std::string::npos)
        return std::nullopt;
    const auto tEnd = token.find_last_not_of(" \t");
    return token.substr(tBegin, tEnd - tBegin + 1);
}
}  // namespace

Task<std::optional<User>> optionalUser(std::shared_ptr<AppState> state,
                                       drogon::HttpRequestPtr req)
{
    const auto token = parseBearer(req);
    if (!token)
        co_return std::nullopt;
    const auto decoded = security::decodeAccessToken(state->config, *token,
                                                     iso_date::now() / 1000000);
    if (!decoded.subject)
        co_return std::nullopt;
    const auto id = normalizeUuid(*decoded.subject);
    if (!id)
        co_return std::nullopt;
    co_return co_await repo_users::findById(*state->db, state->db->client(), *id);
}

Task<User> requiredUser(std::shared_ptr<AppState> state, drogon::HttpRequestPtr req)
{
    const auto token = parseBearer(req);
    if (!token)
        throw ApiError::unauthorized("缺少 access token");
    const auto decoded = security::decodeAccessToken(state->config, *token,
                                                     iso_date::now() / 1000000);
    if (!decoded.subject)
        throw ApiError::unauthorized(decoded.error ? decoded.error : "invalid_token");
    const auto id = normalizeUuid(*decoded.subject);
    if (!id)
        throw ApiError::unauthorized("invalid_token");
    const auto user = co_await repo_users::findById(*state->db, state->db->client(), *id);
    if (!user)
        throw ApiError::unauthorized("用户不存在");
    co_return *user;
}
}  // namespace auth_context
