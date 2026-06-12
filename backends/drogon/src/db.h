#pragma once

#include <drogon/orm/DbClient.h>
#include <drogon/utils/coroutine.h>

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "config.h"

// 跨库数据访问入口：PostgreSQL（连接池）与 SQLite（连接数 1，天然串行）。
//
// 关键设计：**所有绑定参数都是字符串**，SQL 只写一份（`?` 占位，执行前统一转
// `$1..$n`——PG 原生支持；SQLite 的 `$1` 是合法命名参数，按出现顺序绑定到同样的
// 位置）。PG 走 libpq 文本协议，由列上下文推断类型（uuid/timestamptz/boolean 均
// 接受 ISO 文本）；SQLite 靠列亲和性把 '0'/'1' 文本转成 INTEGER。
// 读取同样文本化：Field::as<std::string>() 后由 row_get 助手按格式还原。
// LIMIT/OFFSET 直接内联整数（服务端计算值，无注入面）。
class Db
{
  public:
    static std::shared_ptr<Db> connect(const AppConfig &config);

    bool isSqlite() const
    {
        return isSqlite_;
    }

    drogon::orm::DbClientPtr client() const
    {
        return client_;
    }

    // ── 值编码：业务层只描述语义类型，驱动差异在这里分流 ────────────────────
    std::string uuidValue(const std::string &dashed) const;  // sqlite: 去横线 hex
    std::string tsValue(int64_t micros) const;               // 双驱动同用 ISO 微秒格式
    std::string boolValue(bool b) const;                     // '1'/'0'（PG 布尔也接受）

    // 在 client 或 transaction 上执行参数化 SQL（params 全为文本）。
    static drogon::Task<drogon::orm::Result> query(drogon::orm::DbClientPtr exec,
                                                   std::string sql,
                                                   std::vector<std::string> params);

    drogon::Task<std::shared_ptr<drogon::orm::Transaction>> transaction();

    // 显式等待提交完成（Transaction 析构是**异步**发 COMMIT——若不等待，
    // 响应可能先于提交发出，下一个请求经连接池其它连接读不到刚写的数据；
    // PG 池=8 时此竞态真实可见，SQLite 单连接 FIFO 天然无感）。
    // 调用方必须 move 进来（确保是最后一个引用，reset 即触发析构提交）。
    static drogon::Task<void> awaitCommit(std::shared_ptr<drogon::orm::Transaction> trans);

  private:
    bool isSqlite_{false};
    drogon::orm::DbClientPtr client_;
};

// `?` 占位转 $1..$n。约定：业务 SQL 不含字面 `?`（所有值都走绑定）。
std::string toDollarPlaceholders(const std::string &sql);

// ── 行读取助手：文本 → 领域类型 ─────────────────────────────────────────────
namespace row_get
{
std::string str(const drogon::orm::Row &row, const char *col);
int64_t i64(const drogon::orm::Row &row, const char *col);
bool boolean(const drogon::orm::Row &row, const char *col);  // t/f/true/false/0/1
std::string uuid(const drogon::orm::Row &row, const char *col);  // 归一化为小写带横线
int64_t ts(const drogon::orm::Row &row, const char *col);
std::optional<int64_t> tsOpt(const drogon::orm::Row &row, const char *col);
}  // namespace row_get

// 宽松解析 UUID：接受 32 位 hex 或 36 位带横线，归一化为小写带横线；
// 非法返回 nullopt（调用方据此转 404）。
std::optional<std::string> normalizeUuid(const std::string &raw);
// 生成 v4 UUID（小写带横线）。
std::string newUuid();
