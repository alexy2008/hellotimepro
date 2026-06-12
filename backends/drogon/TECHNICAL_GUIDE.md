# Drogon 后端技术手册

本手册带你读懂 `backends/drogon/` 的每一层：为什么这样选型、请求如何流过各层、
跨库兼容怎么做、C++ 协程的几个坑、以及改代码时该从哪里下手。配合源码阅读效果最佳。

---

## 1. 技术选型与理由

| 维度 | 选择 | 理由 |
|---|---|---|
| Web 框架 | Drogon 1.9.12 | C++ 生态最成熟的异步 HTTP 框架；自带 ORM、HttpClient、协程支持，免去拼七八个库 |
| 获取方式 | FetchContent 静态链接 | brew 无 drogon formula；锁定版本可复现（v1 项目验证过的 tag） |
| 数据访问 | Drogon ORM 裸 SQL | `Mapper<T>` 模板对跨库双驱动反而碍事；execSqlCoro + 手写 SQL 与其它栈一致 |
| JSON | jsoncpp（drogon 内置依赖） | `Json::nullValue` 序列化为显式 `null`，契约 strict equal 直接满足 |
| 密码 | OpenBSD bcrypt（third_party） | C++ 无标准 bcrypt；复制本仓库 nest 后端 node_modules/bcrypt 的 ISC 许可源码，零新增外部依赖 |
| JWT | OpenSSL HMAC 手写 | HS256 签发/校验各 ~30 行；C++ JWT 库普遍重且引依赖 |
| 异步模型 | C++20 协程（co_await） | 回调金字塔在 10+ 步的事务流程里不可维护；drogon 的 Task<>/execSqlCoro 已经成熟 |

## 2. 目录地图

```
src/
  main.cc              入口：日志级别 → AppState::build → CORS/404 → 路由 → app().run()
  config.h/.cc         AppConfig / LlmConfig（全部环境变量驱动）
  app_state.h          AppState（Db/头像/限流器/LLM/模板），build 实现在 main.cc
  domain.h             User / Capsule / CapsuleView / RefreshTokenRow（UUID 为字符串）
  api_error.h          ApiError（status/code/message/details + 工厂方法）
  json_util.h/.cc      envelope::ok / error / noContent
  routes.h/.cc         全部路由注册 + guarded() 异常包装 + 健康/静态文件
  services.h/.cc       auth/user/capsule/plaza/favorite 服务 + auth_context
  validation.h/.cc     字段校验（std::regex + UTF-8 码点扫描）
  security.h/.cc       bcrypt 包装 / JWT / refresh token / base64url
  mapper.h/.cc         领域模型 → Json::Value（detail/listItem/pagination）
  db.h/.cc             Db：连接、query 变参分发、awaitCommit、row_get 解码
  repos.h/.cc          repo_users / repo_capsules / repo_favorites / repo_refresh_tokens
  iso_date.h/.cc       ISO-8601 解析（含 PG 文本格式）与两种输出
  llm_client.h/.cc     LLM 客户端（chat/responses/auto + 重试 + 日志规范）
  suggestion_service / recommendation_service / avatar_service / rate_limiter
tests/unit_tests.cc    35 项纯函数断言（assert 风格，不引测试框架）
third_party/openbsd_bcrypt/  bcrypt.cc / blowfish.cc / node_blf.h（见 §10）
```

## 3. 运行与验证

```bash
./build                                                  # 首次 4-5 分钟（编译 drogon 本体）
./run                                                    # DB_DRIVER=postgres（默认）
DB_DRIVER=sqlite ./run                                   # SQLite
./test                                                   # 35 项单元测试
./verification/scripts/verify-contract.sh drogon         # 契约 104 用例（PG）
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh drogon
```

构建目录是 `build-out/`（`build` 名字被脚本占用，同 ktor）。

## 4. 入口与装配（main.cc）

顺序：`LOG_LEVEL` → trantor 日志级别（默认 info，LLM 日志规范要求）→
`AppState::build`（Db 连接、头像目录、限流器、LLM 客户端、prompt 模板）→
CORS（PreRouting 拦 OPTIONS 204 + PostHandling 加 ACAO 头）→
`setCustom404Page`（契约 404 外壳替代 drogon 默认 HTML）→ `registerRoutes` → `app().run()`。

## 5. 路由层（routes.cc）

handler 的固定形态——drogon 协程 lambda + `guarded()` 模板包装：

```cpp
app.registerHandler("/api/v1/capsules",
    [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
        co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
            const User user = co_await auth_context::requiredUser(state, req);
            const auto body = requireJsonBody(req);
            co_return envelope::ok(co_await capsule_service::create(state, user, body),
                                   drogon::k201Created);
        });
    },
    {drogon::Post});
```

- `guarded()` 把 `ApiError` / `DrogonDbException` / `std::exception` 统一转契约错误外壳——
  C++ 没有 Rust 的 `IntoResponse`，这是等价物。
- 请求体：`requireJsonBody` 把坏 JSON 转 422 +`details=[("body",...)]`；
  字段缺失/类型不符由 services.cc 的 `optStr/optBool` 裁决（present-but-wrong-type 也是 422）。
- 查询参数：`intParam` 区分"缺失 → 默认值"和"存在但非整数 → 422"。
- 路径参数：drogon 的 `{param}` 语法直接绑定到 lambda 的 `std::string` 参数。

## 6. 跨库数据层（db.cc）—— 本实现的核心

### 6.1 一份 SQL，文本协议

与 Axum 的 Value/Cell 枚举不同，这里更激进：**绑定参数全部是 `std::string`**。

| 语义类型 | 绑定文本 | PG 行为 | SQLite 行为 |
|---|---|---|---|
| UUID | PG 带横线 / SQLite 32 位 hex | 列上下文推断为 uuid，文本解析 | TEXT 直存 |
| 时间戳 | `…T….SSSSSS+00:00`（双驱动同一格式） | timestamptz 文本解析 | TEXT 直存（与 seed 逐字符一致） |
| 布尔 | `'1'` / `'0'` | boolean 字面量接受 0/1 | INTEGER 亲和性转整数 |
| 整数 | `std::to_string` | int 推断 | INTEGER 亲和性 |

LIMIT/OFFSET 直接内联整数（服务端计算值，无注入面）——绕开两库对
"LIMIT 文本参数"的不一致。

占位符：SQL 写 `?`，`toDollarPlaceholders` 统一转 `$1..$n`。PG 原生；SQLite 的
`$1` 恰好是合法命名参数（TCL 风格），按出现顺序得到与位置一致的 index。

### 6.2 变参分发

`execSqlCoro` 是变参模板，动态参数列表无法直接展开——`Db::query` 用
`switch (params.size())` 0..10 逐档展开。参数已统一为 string，所以每档只有一种类型组合。

### 6.3 读取：row_get

PG 文本结果与 SQLite 存储都以 `Field::as<std::string>()` 读出，再按格式还原：
`uuid`（hex/带横线归一化）、`ts`（解析器容忍 PG 的 `2026-… 08:30:00.5+00`——
空格分隔、截尾小数、**2 位短偏移**）、`boolean`（t/f/true/false/0/1）、`i64`。
访问器是格式驱动的，仓储代码不需要知道自己跑在哪个库上。

## 7. 事务：异步析构提交的坑（必读）

drogon `Transaction` 的提交时机是**最后一个 shared_ptr 析构时异步发送 COMMIT**。
直接依赖析构会出现：响应已发出 → 客户端立刻发下一请求 → PG 连接池（8 连接）把它
路由到另一条连接 → **刚写的数据还没提交，读不到**。本实现首轮 PG 契约就撞上了
（register 后随即 401、创建后搜索不到，且两次失败点不同——典型竞态特征）。

解法 `Db::awaitCommit`：用 `setCommitCallback` 包一个 `CallbackAwaiter`，
释放最后引用触发析构提交，回调里 resume——**提交完成后才返回**：

```cpp
auto trans = co_await state->db->transaction();
Json::Value result;
try { /* 多步业务，可 throw ApiError */ }
catch (...) { trans->rollback(); throw; }   // 业务失败显式回滚（析构默认是提交！）
co_await Db::awaitCommit(std::move(trans)); // Ok 路径：等提交落地
co_return result;
```

三个纪律：

1. **catch 里必须 rollback**——drogon 析构语义是 commit，不回滚业务异常前的写入；
2. **co_return 不能写在 try 里**——会绕过 awaitCommit 退回析构异步提交；
3. **awaitCommit 必须 move**——它靠"释放最后引用"触发提交。

refresh 的重用检测沿用各栈一致的 outcome 模式：事务内不抛业务错，
`awaitCommit` 之后再把 Reused/Invalid 转成 401（家族吊销必须先提交）。

## 8. C++ 协程限制：catch 里不能 co_await

语言规定 catch handler 内禁止 `co_await`。所有"失败后异步补救"都要改写成
"catch 记 flag，try 外 co_await"——本实现有三处：LLM auto 风格回落 chat、
chat 的 thinking 字段 400 重试、postJson 的退避重试。事务的 rollback() 是
同步方法所以不受限。

## 9. 鉴权与安全

- **JWT HS256**（security.cc）：`base64url(header).base64url(payload).base64url(HMAC)`；
  校验顺序：三段形态 → `CRYPTO_memcmp` 常数时间比签名 → payload 解析 → exp。
  过期 `access_token_expired` / 非法 `invalid_token`（契约区分这两个 message）。
- **refresh token**：32 字节 `arc4random_buf` → base64url；落库只存 SHA-256 hex。
- **登录限流**：互斥锁保护的每邮箱 60 秒滑动窗口（drogon 多 IO 线程并发）。
- **bcrypt**：cost 10 签发 `$2b$`；验证兼容 `$2a$`（PG seed 经 pgcrypto 生成）与
  `$2b$`（SQLite seed 经 Python bcrypt 生成）。单元测试内嵌 Python bcrypt
  生成的已知向量做互验。

## 10. third_party/openbsd_bcrypt 的来历

C++ 没有标准 bcrypt。本目录三个文件（`bcrypt.cc`、`blowfish.cc`、`node_blf.h`）
**原样复制自本仓库 `backends/nest/node_modules/bcrypt/src/`**——即 npm `bcrypt` 包
内嵌的 OpenBSD 实现（Niels Provos 原版，ISC/BSD 许可，保留原始版权头）。
选它的理由：已在本项目依赖树内、nest 后端用它通过过同一套契约验证、零新增外部来源。
`security.cc` 在其上包了 salt 生成（`'b'`、cost 10、16 随机字节）与常数时间比较。

## 11. 校验（validation.cc）

对齐 `spec/openapi.yaml`，长度一律按 **UTF-8 码点**计数。两个 std::regex 限制的绕法：

- 不支持 lookahead → 密码"含字母 + 含数字"显式字符扫描；
- 不支持 `\p{L}\p{N}` → 昵称 UTF-8 码点扫描：ASCII 必须 `[A-Za-z0-9_-]`，
  ≥U+0080 放行（比 Unicode 属性表略宽，教学项目可接受，注释已声明）。

## 12. LLM 客户端（llm_client.cc）

- 日志规范：INFO `LLM request model= url=` / INFO `LLM response model= elapsed_ms= tokens=`
  / WARN `LLM error model= elapsed_ms= status=/error=`（usage 缺失记 n/a）。
- 重试：仅传输层错误（超时/SSL EOF），退避递增；HTTP 4xx/5xx 与坏 JSON 不重试。
- api_style：chat（默认）/ responses / auto；chat 带 `thinking:{type:disabled}`，
  网关 400 不认时去掉重试。
- base_url 拆 origin + path 前缀（`https://gw.example.com/v1` 这类带路径的网关）。
- 建议端点失败走 7 条中文模板本地兜底；推荐端点失败返回空列表 `generatedBy=none`。

## 13. 测试（./test）

35 项纯函数断言：iso_date 解析变体（含 PG 短偏移）/格式往返/文本序、UUID 归一化、
validation 全规则、JWT 往返/过期/篡改、refresh token 形态、bcrypt 往返 + seed 向量互验、
`?`→`$n` 转换、8 位码、LLM 围栏/花括号/浮点容忍、推荐去重钳位、标题清洗、码点截断。
契约行为（104 用例）由 `verification/` 黑盒覆盖，不在单元层重复。

## 14. 改代码从哪里下手

| 想改什么 | 动哪里 |
|---|---|
| 新增端点 | `routes.cc` 注册 + handler（记得 guarded 包装）；业务进 `services.cc` |
| 新增字段校验 | `validation.cc`（对照 spec/openapi.yaml，按码点计数） |
| 新增表/查询 | `repos.cc` 加函数；绑定走 `db.uuidValue/tsValue/boolValue`，读取走 `row_get` |
| 改响应结构 | `mapper.cc`（注意显式 null 字段） |
| 调事务边界 | services.cc 的 try/rollback/awaitCommit 三件套，纪律见 §7 |
| 升级 drogon | CMakeLists 的 GIT_TAG；注意重验协程 handler 与 setCommitCallback 行为 |

## 15. 推荐阅读顺序

1. `main.cc` + `app_state.h`（5 分钟，骨架）
2. `routes.cc` 任挑一个 handler 跟到底（guarded → service → envelope）
3. `db.h/.cc`（文本化跨库 + awaitCommit，§6/§7 对照读）
4. `services.cc` 的 `refresh`（事务一致性代表作）
5. `security.cc` + `third_party/openbsd_bcrypt`（§9/§10）
6. 其余按需。
