#include "db.h"

#include <cstdio>
#include <cstdlib>
#include <stdexcept>

#include "api_error.h"
#include "iso_date.h"

namespace
{
// 解析 `postgresql://user:pass@host:port/db` → libpq 连接串。
std::string pgConnInfo(const std::string &url)
{
    std::string host = "127.0.0.1";
    std::string port = "55432";
    std::string user = "hellotime";
    std::string pass = "hellotime";
    std::string dbname = "hellotime_pro";

    const auto schemeEnd = url.find("://");
    if (schemeEnd != std::string::npos)
    {
        std::string rest = url.substr(schemeEnd + 3);
        const auto at = rest.rfind('@');
        if (at != std::string::npos)
        {
            const std::string creds = rest.substr(0, at);
            rest = rest.substr(at + 1);
            const auto colon = creds.find(':');
            if (colon != std::string::npos)
            {
                if (colon > 0)
                    user = creds.substr(0, colon);
                pass = creds.substr(colon + 1);
            }
            else if (!creds.empty())
                user = creds;
        }
        const auto slash = rest.find('/');
        std::string hostPort = slash == std::string::npos ? rest : rest.substr(0, slash);
        if (slash != std::string::npos)
        {
            std::string db = rest.substr(slash + 1);
            const auto q = db.find('?');
            if (q != std::string::npos)
                db = db.substr(0, q);
            if (!db.empty())
                dbname = db;
        }
        const auto colon = hostPort.find(':');
        if (colon != std::string::npos)
        {
            if (colon > 0)
                host = hostPort.substr(0, colon);
            port = hostPort.substr(colon + 1);
        }
        else if (!hostPort.empty())
            host = hostPort;
    }
    return "host=" + host + " port=" + port + " dbname=" + dbname + " user=" + user +
           " password=" + pass;
}

std::string sqlitePath(const AppConfig &config)
{
    const std::string prefix = "sqlite://";
    if (config.dbUrl.rfind(prefix, 0) == 0)
        return config.dbUrl.substr(prefix.size());  // sqlite:///abs → /abs
    return config.absRepoRoot() + "/data/sqlite/hellotime-drogon.db";
}
}  // namespace

std::shared_ptr<Db> Db::connect(const AppConfig &config)
{
    auto db = std::make_shared<Db>();
    db->isSqlite_ = config.isSqlite();
    if (db->isSqlite_)
    {
        // 连接数 1：全部访问天然串行（对应 Axum 的池上限 1 / Vapor 的 FIFO 门闩）。
        db->client_ = drogon::orm::DbClient::newSqlite3Client(
            "filename=" + sqlitePath(config), 1);
        db->client_->execSqlSync("PRAGMA foreign_keys = ON");
        db->client_->execSqlSync("PRAGMA busy_timeout = 5000");
    }
    else
    {
        db->client_ = drogon::orm::DbClient::newPgClient(pgConnInfo(config.dbUrl), 8);
    }
    return db;
}

std::string Db::uuidValue(const std::string &dashed) const
{
    if (!isSqlite_)
        return dashed;
    std::string hex;
    hex.reserve(32);
    for (char c : dashed)
        if (c != '-')
            hex.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    return hex;
}

std::string Db::tsValue(int64_t micros) const
{
    // 双驱动同一格式：SQLite 与 seed 逐字符一致；PG timestamptz 接受 ISO 文本输入。
    return iso_date::sqliteString(micros);
}

std::string Db::boolValue(bool b) const
{
    // SQLite 列亲和性把 '1' 转 INTEGER；PG 布尔字面量接受 '1'/'0'。
    return b ? "1" : "0";
}

std::string toDollarPlaceholders(const std::string &sql)
{
    std::string out;
    out.reserve(sql.size() + 8);
    int n = 0;
    for (char c : sql)
    {
        if (c == '?')
        {
            ++n;
            out += '$';
            out += std::to_string(n);
        }
        else
            out += c;
    }
    return out;
}

drogon::Task<drogon::orm::Result> Db::query(drogon::orm::DbClientPtr exec,
                                            std::string sql,
                                            std::vector<std::string> params)
{
    const std::string q = toDollarPlaceholders(sql);
    const auto &p = params;
    // execSqlCoro 是变参模板；参数已统一为 std::string，按个数分发。
    switch (p.size())
    {
        case 0:
            co_return co_await exec->execSqlCoro(q);
        case 1:
            co_return co_await exec->execSqlCoro(q, p[0]);
        case 2:
            co_return co_await exec->execSqlCoro(q, p[0], p[1]);
        case 3:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2]);
        case 4:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3]);
        case 5:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4]);
        case 6:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5]);
        case 7:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
        case 8:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7]);
        case 9:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8]);
        case 10:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9]);
        case 11:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10]);
        case 12:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10], p[11]);
        case 13:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10], p[11], p[12]);
        case 14:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10], p[11], p[12], p[13]);
        case 15:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10], p[11], p[12], p[13],
                                                 p[14]);
        case 16:
            co_return co_await exec->execSqlCoro(q, p[0], p[1], p[2], p[3], p[4], p[5], p[6],
                                                 p[7], p[8], p[9], p[10], p[11], p[12], p[13],
                                                 p[14], p[15]);
        // 当前最大用量：capsules 插入 10 个绑定参数（repos.cc）。上限 16，新增字段时按需扩档。
        default:
            throw ApiError::internal("绑定参数过多: " + std::to_string(p.size()));
    }
}

drogon::Task<std::shared_ptr<drogon::orm::Transaction>> Db::transaction()
{
    co_return co_await client_->newTransactionCoro();
}

namespace
{
struct CommitAwaiter : public drogon::CallbackAwaiter<bool>
{
    explicit CommitAwaiter(std::shared_ptr<drogon::orm::Transaction> trans)
        : trans_(std::move(trans))
    {
    }

    void await_suspend(std::coroutine_handle<> handle)
    {
        trans_->setCommitCallback([this, handle](bool committed) {
            setValue(committed);
            handle.resume();
        });
        trans_.reset();  // 释放最后引用 → 析构发送 COMMIT → 完成后回调
    }

  private:
    std::shared_ptr<drogon::orm::Transaction> trans_;
};
}  // namespace

drogon::Task<void> Db::awaitCommit(std::shared_ptr<drogon::orm::Transaction> trans)
{
    const bool committed = co_await CommitAwaiter(std::move(trans));
    if (!committed)
        throw ApiError::internal("事务提交失败");
}

// ── 行读取助手 ───────────────────────────────────────────────────────────────

namespace row_get
{
std::string str(const drogon::orm::Row &row, const char *col)
{
    return row[col].as<std::string>();
}

int64_t i64(const drogon::orm::Row &row, const char *col)
{
    const std::string v = row[col].as<std::string>();
    try
    {
        return std::stoll(v);
    }
    catch (...)
    {
        throw ApiError::internal(std::string("列不是整数: ") + col + " = " + v);
    }
}

bool boolean(const drogon::orm::Row &row, const char *col)
{
    const std::string v = row[col].as<std::string>();
    return v == "t" || v == "true" || v == "1";
}

std::string uuid(const drogon::orm::Row &row, const char *col)
{
    const auto u = normalizeUuid(row[col].as<std::string>());
    if (!u)
        throw ApiError::internal(std::string("非法 UUID 列值: ") + col);
    return *u;
}

int64_t ts(const drogon::orm::Row &row, const char *col)
{
    const auto t = iso_date::parse(row[col].as<std::string>());
    if (!t)
        throw ApiError::internal(std::string("非法时间列值: ") + col);
    return *t;
}

std::optional<int64_t> tsOpt(const drogon::orm::Row &row, const char *col)
{
    if (row[col].isNull())
        return std::nullopt;
    return ts(row, col);
}
}  // namespace row_get

// ── UUID ─────────────────────────────────────────────────────────────────────

std::optional<std::string> normalizeUuid(const std::string &raw)
{
    std::string hex;
    hex.reserve(32);
    size_t begin = raw.find_first_not_of(" \t");
    size_t end = raw.find_last_not_of(" \t");
    if (begin == std::string::npos)
        return std::nullopt;
    const std::string s = raw.substr(begin, end - begin + 1);

    if (s.size() == 36)
    {
        // 横线必须在 8-4-4-4-12 的固定位置。
        for (size_t i = 0; i < s.size(); ++i)
        {
            const bool dashPos = i == 8 || i == 13 || i == 18 || i == 23;
            if (dashPos)
            {
                if (s[i] != '-')
                    return std::nullopt;
            }
            else
            {
                if (!std::isxdigit(static_cast<unsigned char>(s[i])))
                    return std::nullopt;
                hex.push_back(
                    static_cast<char>(std::tolower(static_cast<unsigned char>(s[i]))));
            }
        }
    }
    else if (s.size() == 32)
    {
        for (char c : s)
        {
            if (!std::isxdigit(static_cast<unsigned char>(c)))
                return std::nullopt;
            hex.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
        }
    }
    else
        return std::nullopt;

    return hex.substr(0, 8) + "-" + hex.substr(8, 4) + "-" + hex.substr(12, 4) + "-" +
           hex.substr(16, 4) + "-" + hex.substr(20);
}

std::string newUuid()
{
    unsigned char bytes[16];
    arc4random_buf(bytes, sizeof(bytes));
    bytes[6] = static_cast<unsigned char>((bytes[6] & 0x0F) | 0x40);  // version 4
    bytes[8] = static_cast<unsigned char>((bytes[8] & 0x3F) | 0x80);  // variant 10
    char out[37];
    std::snprintf(out, sizeof(out),
                  "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
                  bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6],
                  bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13],
                  bytes[14], bytes[15]);
    return out;
}
