# HelloTime Pro Drogon 后端技术手册与代码导读

本文面向已经熟悉 C++ 基本语法（类、模板、`std::optional`、智能指针、lambda），但还没系统接触过
**C++20 协程**或 Drogon 这套异步 Web 技术栈的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Drogon 后端后，代码按什么顺序、在哪个协程里执行。
- Drogon / Trantor、C++20 协程、jsoncpp、OpenSSL、OpenBSD bcrypt 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：§1～§4 建立选型、地图、入口的整体认识；**§5 是理解全篇的钥匙**——讲清 C++20 协程
> 在这个后端里的三个核心机制（`Task<>`/`co_await`、`guarded()`、handler lambda）；§6～§9 按一次请求
> 的生命周期分层细讲，其中 **§7、§8 是两段必读的 C++ 协程踩坑实录**；§13 用一次注册请求把全链路串起来。

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

端口 **29080**（见根 `CLAUDE.md` 端口分配）。

一句话画像：**这是十个后端里"最贴底层、最少依赖"的一个**——UUID 是手写的、JWT 是 OpenSSL HMAC 拼的、
bcrypt 是复制进来的源码、跨库差异靠纯文本协议抹平。代价是样板多、踩坑深；回报是没有任何隐藏魔法。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Drogon 后端的职责是：

- 提供 `/api/v1/*` HTTP API（与 `spec/api/openapi.yaml` 对齐）。
- 校验请求数据（邮箱、密码、昵称、胶囊开启时间等，长度按 UTF-8 码点计）。
- 处理注册、登录、JWT access token、refresh token 轮转（含令牌族追踪）。
- 读写用户/胶囊/收藏/refresh token，并维护反规范化字段 `favorite_count`。
- 在 PostgreSQL 和 SQLite 间无缝切换，同一份业务 SQL 两边都跑。
- 暴露 `spec/avatars/*`、`spec/icons/*` 静态资源，提供 LLM 胶囊建议/推荐接口。

核心目录：

```text
backends/drogon/
├── CMakeLists.txt              # FetchContent 拉取并静态链接 drogon
├── run / build / test          # 三个脚本（build 产物在 build-out/，避让同名 build 脚本）
├── third_party/openbsd_bcrypt/ # 从 nest 的 node_modules/bcrypt 复制的 ISC 许可实现（见 §10）
└── src/
    ├── main.cc                 # 入口：日志级别 → AppState::build → CORS/404 → 路由 → app().run()
    ├── config.h/.cc            # AppConfig / LlmConfig（全部环境变量驱动）
    ├── app_state.h             # AppState（Db/头像/限流器/LLM/模板），build 实现在 main.cc
    ├── domain.h                # User / Capsule / CapsuleView / RefreshTokenRow（UUID 为字符串）
    ├── api_error.h             # ApiError（status/code/message/details + 工厂方法）
    ├── json_util.h/.cc         # envelope::ok / error / noContent
    ├── routes.h/.cc            # 路由注册 + guarded() 异常包装 + 健康/静态文件
    ├── services.h/.cc          # auth/user/capsule/plaza/favorite 服务 + auth_context
    ├── validation.h/.cc        # 字段校验（std::regex + UTF-8 码点扫描）
    ├── security.h/.cc          # bcrypt 包装 / JWT / refresh token / base64url
    ├── mapper.h/.cc            # 领域模型 → Json::Value（detail/listItem/pagination）
    ├── db.h/.cc                # Db：连接、query 变参分发、awaitCommit、row_get 解码
    ├── repos.h/.cc             # repo_users / repo_capsules / repo_favorites / repo_refresh_tokens
    ├── iso_date.h/.cc          # ISO-8601 解析（含 PG 文本格式）与两种输出
    └── llm_client.h/.cc        # LLM 客户端（chat/responses/auto + 重试 + 日志规范）
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Trantor 事件循环（多 IO 线程）
  │ 解析 HTTP，匹配 registerHandler 注册的路径
  ▼
协程 handler lambda  ── co_await guarded([&] { ... })
  │ auth_context::requiredUser(state, req)   解析 Bearer
  │ requireJsonBody(req) / intParam(req,...)  取参
  ▼
services.cc 协程     ── co_await state->db->transaction()
  │ 业务规则；多步操作在一个事务里；catch 回滚、awaitCommit 提交
  ▼
repos.cc → db.cc     ── co_await exec->execSqlCoro(...)
  │ 一份 SQL，文本协议绑定
  ▼
PostgreSQL（连接池 8）或 SQLite（单连接，天然串行）
```

返回方向：service 返回 `Json::Value`，handler 用 `envelope::ok(...)` 包成成功外壳；
任何 `ApiError` 被 `guarded()` 捕获转成契约错误外壳。

## 3. 如何运行和验证

```bash
cd backends/drogon
./build                                                  # 首次 4-5 分钟（编译 drogon 本体）
./run                                                    # DB_DRIVER=postgres（默认）
DB_DRIVER=sqlite ./run                                   # SQLite，零外部依赖
./test                                                   # 35 项单元测试
../../verification/scripts/verify-contract.sh drogon         # 契约 104 用例（PG）
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh drogon
```

- **首次构建慢**：`CMakeLists.txt` 用 FetchContent 把 drogon 源码拉下来静态链接，第一次要编 4-5 分钟；
  之后增量。契约脚本的就绪窗口对 C++ 冷启动放宽，但建议先 `./build` 预热。
- **构建目录是 `build-out/`**：`build` 这个名字被同名构建脚本占用，CMake 输出另取目录避让。
- `run` 不建表、不迁移、不 seed——schema 由仓库级 `scripts/db reset --seed` 准备。

## 4. 入口与装配：`main.cc`

`main()` 顺序很短，但每一步都对应一个契约约束：

```cpp
int main() {
    const AppConfig config = AppConfig::fromEnvironment();   // 环境变量 → 强类型配置
    auto state = AppState::build(config);                    // Db/头像/限流/LLM/模板 一次装配

    auto &app = drogon::app();
    app.setLogLevel(parseLogLevel());                        // 默认 INFO（LLM 日志规范要求可见）
    app.addListener(config.host, config.port);

    // 未匹配路由 → 契约 404 外壳（替代 drogon 默认 HTML 404）
    app.setCustom404Page(envelope::error(ApiError::notFound("资源不存在")), false);

    // CORS：PreRouting 拦 OPTIONS 直接 204；PostHandling 给所有响应加 ACAO 头
    app.registerPreRoutingAdvice(...);
    app.registerPostHandlingAdvice(...);

    registerRoutes(state);                                   // 注册全部 /api/v1/* + 静态资源
    app.run();                                               // 阻塞，Trantor 事件循环接管
}
```

- **`AppState::build`**（实现也在 main.cc）：把 `Db`、`AvatarService`、`LoginRateLimiter`、`LlmClient`、
  两个 AI service 一次性 new 出来塞进一个 `shared_ptr<AppState>`，全程只有这一份，按 `state` 捕获进每个 handler。
- **`parseLogLevel()`**：读 `LOG_LEVEL`，默认 `info`——因为 LLM 日志规范要求 `LLM request/response` 这类
  INFO 事件可见（trantor 默认级别会吞掉）。`warning` 归一成 `kWarn`。
- **自定义 404 / CORS** 都是为了对齐契约：drogon 默认 404 是 HTML，必须换成 `{success:false,...}` 外壳。

## 5. C++20 协程 + Drogon 的几个关键思想

Drogon 把"异步 IO"用 C++20 协程包装得相当干净。看懂下面三件事，全篇剩下的都是常规 C++。

### 5.1 `Task<T>` 与 `co_await`：为什么用协程不用回调

drogon 的异步原语返回 `drogon::Task<T>`（一个协程类型）。在协程函数里，`co_await` 一个
`Task<T>` 就拿到结果 `T`，写法和同步代码一样直；底层是"挂起当前协程、IO 完成后在事件循环线程上恢复"。

```cpp
// 同步风格的写法，异步的执行
const auto user = co_await repo_users::findByEmail(*state->db, trans, email);
if (user && security::verifyPassword(password, user->passwordHash))
    tokens = co_await issueTokenPair(state, trans, *user, std::nullopt);
```

如果没有协程，一个"查用户 → 验密码 → 插 token → 提交"的流程要写成四层嵌套回调（callback hell），
而 refresh 轮转有 6+ 步，几乎不可维护。这就是这个后端选协程的根本原因（§1 表格末行）。

### 5.2 `guarded()`：协程版的"异常 → 错误外壳"

C++ 没有 Rust 的 `IntoResponse`、也没有 Spring 的 `@RestControllerAdvice`。本实现用一个模板函数
`guarded()` 充当"统一异常出口"——所有 handler 主体都套在它里面（`routes.cc`）：

```cpp
template <typename F>
Task<HttpResponsePtr> guarded(F body) {
    try { co_return co_await body(); }
    catch (const ApiError &e)                     { co_return envelope::error(e); }            // 业务异常 → 对应状态码
    catch (const drogon::orm::DrogonDbException &e){ LOG_ERROR<<...; co_return envelope::error(ApiError::internal(...)); }
    catch (const std::exception &e)               { LOG_ERROR<<...; co_return envelope::error(ApiError::internal(...)); }
}
```

业务层任何地方 `throw ApiError::notFound("胶囊不存在")`，都会被这里接住转成 404 外壳；
未预期的异常一律降级 500（且写 LOG_ERROR），不会把崩溃栈泄漏给客户端。

### 5.3 handler = 协程 lambda + `shared_ptr<AppState>` 注入

每个路由是一个返回 `Task<HttpResponsePtr>` 的 lambda，按值捕获 `state`（那唯一一份 `AppState`），
主体套 `guarded()`：

```cpp
app.registerHandler("/api/v1/capsules",
    [state](HttpRequestPtr req) -> Task<HttpResponsePtr> {
        co_return co_await guarded([&]() -> Task<HttpResponsePtr> {
            const User user = co_await auth_context::requiredUser(state, req);  // 鉴权（缺失/过期 → 401）
            const auto body = requireJsonBody(req);                            // 坏 JSON → 422
            co_return envelope::ok(co_await capsule_service::create(state, user, body),
                                   drogon::k201Created);
        });
    },
    {drogon::Post});
```

固定套路：**取参 → 调 service → `envelope::ok` 包壳**。鉴权不是中间件而是显式第一行调用——
受保护端点用 `auth_context::requiredUser`，匿名可带态端点（广场/胶囊详情）用 `optionalUser`。
路径参数（`{id}`、`{code}`、`{file}`）直接绑定到 lambda 的 `std::string` 形参。

取参三件套都在 `routes.cc` 的匿名命名空间里：
- `requireJsonBody(req)`：拿不到 JSON 对象 → 422 `details=[("body",...)]`；
- `intParam(req, "page", 1)`：缺失用默认值、**存在但非整数 → 422**（对齐 openapi 的 integer 约束）；
- 字段缺失/类型不符由 service 里的 `optStr/optBool` 裁决（present-but-wrong-type 也是 422）。

### 5.4 jsoncpp 与"显式 null"

契约用 strict equal 断言 `data`/`errorCode`/`content` 等字段为**显式 `null`**。jsoncpp 的
`Json::nullValue` 序列化就是字面 `null`，天然满足——`envelope::ok(data)` 把 `message`/`errorCode`
显式设成 null 值，不会像某些语言的 Optional 那样直接丢键。

## 6. 跨库数据层（db.cc）—— 本实现的核心

### 6.1 一份 SQL，文本协议

与 Axum 的 `Value`/`Cell` 枚举不同，这里更激进：**绑定参数全部是 `std::string`**。

| 语义类型 | 绑定文本 | PG 行为 | SQLite 行为 |
|---|---|---|---|
| UUID | PG 带横线 / SQLite 32 位 hex | 列上下文推断为 uuid，文本解析 | TEXT 直存 |
| 时间戳 | `…T….SSSSSS+00:00`（双驱动同一格式） | timestamptz 文本解析 | TEXT 直存（与 seed 逐字符一致） |
| 布尔 | `'1'` / `'0'` | boolean 字面量接受 0/1 | INTEGER 亲和性转整数 |
| 整数 | `std::to_string` | int 推断 | INTEGER 亲和性 |

LIMIT/OFFSET 直接内联整数（服务端计算值，无注入面）——绕开两库对"LIMIT 文本参数"的不一致。
占位符：SQL 写 `?`，`toDollarPlaceholders` 统一转 `$1..$n`。PG 原生；SQLite 的 `$1` 恰好是合法命名参数
（TCL 风格），按出现顺序得到与位置一致的 index。

### 6.2 变参分发：`switch (params.size())`

`execSqlCoro` 是变参模板，运行时的 `std::vector<std::string>` 无法直接展开成可变模板实参——
`Db::query` 用 `switch (params.size())` 0..16 逐档手动展开。参数已统一为 string，所以每档只有一种类型组合：

```cpp
switch (p.size()) {
    case 0:  co_return co_await exec->execSqlCoro(q);
    case 1:  co_return co_await exec->execSqlCoro(q, p[0]);
    ...
    case 16: co_return co_await exec->execSqlCoro(q, p[0], ..., p[15]);
    // 当前最大用量：capsules 插入 10 个绑定参数（repos.cc）。上限 16，新增字段时按需扩档。
    default: throw ApiError::internal("绑定参数过多");
}
```

### 6.3 读取：`row_get`

PG 文本结果与 SQLite 存储都以 `Field::as<std::string>()` 读出，再按格式还原：`uuid`（hex/带横线归一化）、
`ts`（解析器容忍 PG 的 `2026-… 08:30:00.5+00`——空格分隔、截尾小数、**2 位短偏移**）、`boolean`（t/f/true/false/0/1）、
`i64`。访问器是格式驱动的，仓储代码不需要知道自己跑在哪个库上。

### 6.4 UUID 是手写的

C++ 标准库没有 UUID。`newUuid()` 用 `arc4random_buf` 取 16 字节、手动置 version 4 / variant 位、`snprintf`
成带横线串；`normalizeUuid()` 接受 36 位（校验横线在 8-4-4-4-12 位置）或 32 位 hex，统一归一成带横线小写。
非法返回 `std::nullopt`，调用方据此转 404。

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

`awaitCommit` 的实现是一个 `CallbackAwaiter`（drogon 提供的协程适配基类，见 `db.cc`）：

```cpp
struct CommitAwaiter : drogon::CallbackAwaiter<bool> {
    void await_suspend(std::coroutine_handle<> handle) {
        trans_->setCommitCallback([this, handle](bool committed) {
            setValue(committed);   // 把提交结果回传给 co_await 表达式
            handle.resume();       // 在提交回调里唤醒协程
        });
        trans_.reset();            // 释放最后一个引用 → 析构发 COMMIT → 触发上面的回调
    }
    std::shared_ptr<drogon::orm::Transaction> trans_;
};
```

关键顺序是**先挂回调、再 `reset`**：reset 释放掉 awaiter 持有的最后一个事务引用，
触发析构发送 COMMIT；COMMIT 落地后 drogon 回调 `handle.resume()`，
`co_await awaitCommit(...)` 之后的代码才继续。这就把"不可控的异步析构提交"
改造成了"可 await 的提交"——回到了和其它栈一致的"提交完成才返回"语义。

refresh 的重用检测沿用各栈一致的 outcome 模式：事务内不抛业务错、用 `RefreshOutcome` 枚举区分
`Success/Invalid/Reused`，`awaitCommit` 之后再把 Reused/Invalid 转成 401（家族吊销必须先提交，
否则在事务内抛错会把吊销一起回滚——这是与 Spring `@Transactional(noRollbackFor)` 等价的手写版）。

## 8. C++ 协程限制：catch 里不能 co_await

语言规定 catch handler 内禁止 `co_await`。所有"失败后异步补救"都要改写成
"catch 记 flag，try 外 co_await"——本实现有三处：LLM auto 风格回落 chat、
chat 的 thinking 字段 400 重试、postJson 的退避重试。事务的 `rollback()` 是
**同步方法**所以不受限（这也是 §7 里 catch 能直接 rollback 的原因）。

## 9. 鉴权与安全（security.cc）

`security.cc` 把所有安全原语手写出来，不引第三方 JWT/密码库。

### 9.1 JWT HS256（OpenSSL HMAC）

标准 JWT 形态 `base64url(header).base64url(payload).base64url(HMAC-SHA256)`，签发约 20 行：

```cpp
const std::string signingInput = header + "." + body;          // 两段 base64url
const std::string mac = hmacSha256(config.jwtSecret, signingInput);  // OpenSSL HMAC(EVP_sha256())
return signingInput + "." + base64url(mac...);
```

校验顺序很关键（`decodeAccessToken`）：① 三段形态 → ② `CRYPTO_memcmp` **常数时间**比签名
（防时序侧信道）→ ③ 解析 payload → ④ 检查 `exp`。过期返回 message `access_token_expired`、
其余非法一律 `invalid_token`——契约对这两个 401 message 有区分。

### 9.2 密码与 refresh token

- **bcrypt**（`hashPassword`/`verifyPassword`）：调 `third_party/openbsd_bcrypt`，cost 10、`'b'` 变体，
  `arc4random_buf` 取盐；验证前先做形态防御（长度 59-61、`$2` 前缀），再 `CRYPTO_memcmp` 常数时间比对。
- **refresh token**：`arc4random_buf` 取 32 字节 → `base64url`；落库只存 `SHA256` 的 hex（`hashRefreshToken`）。

### 9.3 base64url 也是手写的

`security.cc` 末尾自带 `base64url` / `base64urlDecode`（URL 安全字母表 `-_`、无 padding），
供 JWT 三段和 refresh token 编码共用——又一处"不引库、摊在明面上"。

## 10. third_party/openbsd_bcrypt 的来历

C++ 没有标准 bcrypt。本目录三个文件（`bcrypt.cc`、`blowfish.cc`、`node_blf.h`）
**原样复制自本仓库 `backends/nest/node_modules/bcrypt/src/`**——即 npm `bcrypt` 包
内嵌的 OpenBSD 实现（Niels Provos 原版，ISC/BSD 许可，保留原始版权头）。
选它的理由：已在本项目依赖树内、nest 后端用它通过过同一套契约验证、零新增外部来源。
`security.cc` 在其上包了 salt 生成（`'b'`、cost 10、16 随机字节）与常数时间比较。

## 11. 校验（validation.cc）

对齐 `spec/openapi.yaml`，长度一律按 **UTF-8 码点**计数——`codepointCount` 数"非延续字节"
（`(c & 0xC0) != 0x80`），避免 CJK 内容按字节数虚高 3 倍。两个 std::regex 限制的绕法：

- 不支持 lookahead → 密码"含字母 + 含数字"显式字符扫描；
- 不支持 `\p{L}\p{N}` → 昵称 UTF-8 码点扫描：ASCII 必须 `[A-Za-z0-9_-]`，
  ≥U+0080 放行（比 Unicode 属性表略宽，教学项目可接受，注释已声明）。

email/avatar/code 用静态 `std::regex`（函数内 static，只编译一次）。失败统一
`throw ApiError::validation(message, field)` → 422 + 逐字段 details。

## 12. LLM 客户端（llm_client.cc）

- 日志规范：INFO `LLM request model= url=` / INFO `LLM response model= elapsed_ms= tokens=`
  / WARN `LLM error model= elapsed_ms= status=/error=`（usage 缺失记 n/a）。
- 重试：仅传输层错误（超时/SSL EOF），退避递增；HTTP 4xx/5xx 与坏 JSON 不重试。
- api_style：chat（默认）/ responses / auto；chat 带 `thinking:{type:disabled}`，
  网关 400 不认时去掉重试（注意 §8：这个"失败后重试"要在 catch 外 co_await）。
- base_url 拆 origin + path 前缀（`https://gw.example.com/v1` 这类带路径的网关）。
- 建议端点失败走 7 条中文模板本地兜底；推荐端点失败返回空列表 `generatedBy=none`。

## 13. 从真实请求读代码：`POST /api/v1/auth/register`

把前面各层串起来，跟一次注册请求走到底（`services.cc` 的 `registerUser`）：

```cpp
Task<Json::Value> registerUser(std::shared_ptr<AppState> state, Json::Value body) {
    // ① 校验（validation.cc）：缺字段/格式错 → 422；optStr 拿不到 String 也 422
    const std::string email = toLower(validation::email(optStr(body, "email")));
    const std::string rawPassword = validation::password(optStr(body, "password"), "password");
    const std::string nickname = validation::nickname(optStr(body, "nickname"));
    const std::string avatarId = validation::avatarFormat(optStr(body, "avatarId"));
    if (!state->avatars->exists(avatarId))
        throw ApiError::validation("头像 ID 不存在", "avatarId");
    const std::string passwordHash = security::hashPassword(rawPassword);  // ② bcrypt（事务外，慢操作）

    auto trans = co_await state->db->transaction();                        // ③ 开事务
    Json::Value result;
    try {
        if (co_await repo_users::existsByEmail(*state->db, trans, email))  // ④ 唯一性预检
            throw ApiError::conflict("邮箱已被注册", "email");
        if (co_await repo_users::existsByNickname(*state->db, trans, nickname))
            throw ApiError::conflict("昵称已被使用", "nickname");
        User user; user.id = newUuid(); /* ... */                         // ⑤ 手写 UUID
        co_await repo_users::insert(*state->db, trans, user);
        result = co_await issueTokenPair(state, trans, user, std::nullopt);// ⑥ 签发 access+refresh，落库
    } catch (...) { trans->rollback(); throw; }                           // ⑦ 失败显式回滚
    co_await Db::awaitCommit(std::move(trans));                           // ⑧ 等提交落地（§7）
    co_return result;
}
```

请求最终回到 `routes.cc` 的 handler：`envelope::ok(result, drogon::k201Created)` 包成
`{success:true, data:{...}}` 的 201 响应。整条链路上：**校验 → 慢哈希放事务外 → 事务内做 IO →
catch 回滚 → awaitCommit**，正是这个后端处理写请求的标准姿势。

> 注意 ② 把 bcrypt 放在事务**之外**：bcrypt cost 10 约几十毫秒，握着事务/连接做慢哈希会拖长
> 持锁时间。其它写路径（改密、登录）同理。

## 14. 测试（./test）

35 项纯函数断言（assert 风格，不引测试框架）：iso_date 解析变体（含 PG 短偏移）/格式往返/文本序、
UUID 归一化、validation 全规则、JWT 往返/过期/篡改、refresh token 形态、bcrypt 往返 + seed 向量互验、
`?`→`$n` 转换、8 位码、LLM 围栏/花括号/浮点容忍、推荐去重钳位、标题清洗、码点截断。
契约行为（104 用例）由 `verification/` 黑盒覆盖，不在单元层重复。

## 15. 改代码从哪里下手

| 想改什么 | 动哪里 |
|---|---|
| 新增端点 | `routes.cc` 注册 + handler（记得 guarded 包装）；业务进 `services.cc` |
| 新增字段校验 | `validation.cc`（对照 spec/openapi.yaml，按码点计数） |
| 新增表/查询 | `repos.cc` 加函数；绑定走 `db.uuidValue/tsValue/boolValue`，读取走 `row_get` |
| 绑定参数超 10 个 | `db.cc` 的 `switch` 已扩到 16 档；再多按需加档 |
| 改响应结构 | `mapper.cc`（注意显式 null 字段） |
| 调事务边界 | services.cc 的 try/rollback/awaitCommit 三件套，纪律见 §7 |
| 加"失败后异步补救" | 记 flag、在 catch 外 co_await（§8 协程限制） |
| 升级 drogon | CMakeLists 的 GIT_TAG；注意重验协程 handler 与 setCommitCallback 行为 |

## 16. 学到这里之后

读到这里，你已经掌握了这个 C++ 后端最关键的部分：`Task<>`/`co_await` 的同步式异步写法、
`guarded()` 统一异常出口、handler lambda + `shared_ptr<AppState>` 注入、文本协议跨库、
以及两段 C++ 协程独有的硬核坑（**§7 异步析构提交、§8 catch 不能 co_await**）。

下一步建议：

- 跟着 §13 的注册链路，自己把 `login` / `refresh` / `addFavorite` 也读一遍，对照它们怎么用同一套
  `transaction → try → rollback → awaitCommit` 骨架。
- 在 `refresh` 里加 `LOG_INFO` 观察一次"正常 → 用旧 token 再刷 → 整族吊销"的行为，这是 refresh 安全模型最直观的演示。
- 把本实现的 `db.cc`（文本协议）和 `backends/axum/src/infra/db.rs`（`Value`/`Cell` 枚举）并排读——
  同一道跨库题，C++ 用纯文本、Rust 用类型枚举，是这个项目最有意思的对照之一。

之后可深入 C++ 协程的进阶主题：自定义 awaiter、`co_yield` 生成器、协程与线程池调度的关系。
本实现刻意只用 drogon 已经封装好的部分，把这些留给后续。

## 17. 推荐阅读顺序

1. `main.cc` + `app_state.h`（5 分钟，骨架）
2. **§5**（协程三件事）配合 `routes.cc` 任挑一个 handler 跟到底（guarded → service → envelope）
3. `db.h/.cc`（文本化跨库 + awaitCommit，§6/§7 对照读）
4. `services.cc` 的 `registerUser`/`refresh`（事务一致性代表作，配合 §13）
5. `security.cc` + `third_party/openbsd_bcrypt`（§9/§10）
6. 其余按需。
