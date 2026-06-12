# Axum 后端技术手册

本手册带你读懂 `backends/axum/` 的每一层：为什么这样选型、请求如何流过各层、
跨库兼容怎么做、以及改代码时该从哪里下手。配合源码阅读效果最佳。

---

## 1. 技术选型与理由

| 维度 | 选择 | 理由 |
|---|---|---|
| Web 框架 | Axum 0.8 | Tokio 官方生态；extractor 模型干净；`IntoResponse` 让错误处理变成类型问题 |
| 数据访问 | sqlx 0.8（不用宏检查） | 契约要求同一套 SQL 跑双驱动，`query!` 宏的编译期检查绑定单一 DB，故用运行时 `sqlx::query` + 自研编解码层 |
| JSON | serde_json::Value | `Value::Null` 序列化为显式 `null`，契约的 strict equal 断言天然满足 |
| JWT | 手写 HS256（hmac + sha2） | 签发/校验各 ~20 行；引 jsonwebtoken crate 反而要适配它的 claim 模型 |
| 密码 | bcrypt crate（cost 10） | 与 seed 数据的 `$2b$` 哈希直接互验 |
| HTTP 客户端 | reqwest（rustls） | LLM 调用；rustls 免去 openssl 链接问题 |

**为什么不用 `sqlx::Any` 驱动？** Any 驱动的类型推断有限，PG 的 `uuid`/`timestamptz`
列用文本协议绑定需要在 SQL 里逐处 `::uuid` 强转，SQL 文本就不再是"一份"。
自研 `Value`/`Cell` 编解码层把差异收敛到绑定/读取两个点，SQL 完全共享。

## 2. 目录地图

```
src/
  main.rs              入口：tracing 初始化 → AppConfig → AppState → Router → serve
  config.rs            AppConfig / LlmConfig（全部环境变量驱动）
  state.rs             AppState（Db/头像目录/HTTP 客户端/prompt 模板/限流器）
  domain.rs            User / Capsule / CapsuleView / RefreshTokenRow
  web/
    routes.rs          全部路由 + handler（参数提取 → service → Envelope）
    error.rs           ApiError（IntoResponse）+ 工厂方法
    envelope.rs        ok / ok_with / error / no_content
    requests.rs        请求体 DTO（字段全 Option，校验层裁决）
    auth.rs            Bearer 解析 + required_user / optional_user
  services/
    validation.rs      字段校验（对齐 spec/openapi.yaml）
    security.rs        bcrypt / JWT HS256 / refresh token 生成与哈希
    auth.rs            注册/登录/刷新/登出/改密 + RefreshOutcome
    user.rs            资料查看/修改
    capsule.rs         创建/按码查询/广场详情/删除 + 8 位码生成
    plaza.rs           广场列表/我创建的/我收藏的（分页）
    favorite.rs        收藏/取消收藏（幂等 + 计数事务）
    mapper.rs          领域模型 → 响应 JSON（detail/listItem/pagination）
    llm.rs             LLM 客户端（chat/responses/auto + 重试 + 日志规范）
    suggestion.rs      AI 胶囊建议（LLM 失败本地兜底）
    recommendation.rs  AI 主题推荐（失败返回空列表）
    avatar.rs          spec/avatars/catalog.json 加载
  infra/
    db.rs              Db / Conn / Value / Cell / DbRow —— 跨库核心
    repos.rs           users / capsules / favorites / refresh_tokens 仓储
    iso_date.rs        ISO-8601 解析与两种输出格式
```

## 3. 运行与验证

```bash
./build                                                 # 预热（首次 4-5 分钟）
./run                                                   # DB_DRIVER=postgres（默认）
DB_DRIVER=sqlite ./run                                  # SQLite
./test                                                  # 25 个纯函数单元测试
./verification/scripts/verify-contract.sh axum          # 契约 104 用例（PG）
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh axum
```

## 4. 入口与状态装配

`main.rs` 顺序：tracing（`LOG_LEVEL` 默认 info，`warning`→`warn` 归一）→
`AppConfig::from_environment()` → `AppState::build()` → `Router` + `CorsLayer::permissive()` →
`axum::serve`。

`AppState`（`state.rs`）手动装配，全部字段在启动时就绪：

- `Db`：按 `DB_DRIVER`/`DB_URL` 建 PgPool（lazy，max 8）或 SqlitePool（max **1**）。
  lazy 连接意味着启动不依赖数据库可达，`/api/v1/health` 不触库。
- `AvatarService`：读 `spec/avatars/catalog.json` 一次，缓存列表 JSON + id 集合。
- `reqwest::Client`：超时取 `LLM_TIMEOUT_MS`。
- prompt 模板：读 `spec/llm/*.prompt.md`，缺失回退内置模板。
- `LoginRateLimiter`：`Mutex<HashMap<email, Vec<Instant>>>` 60 秒滑动窗口。

`Arc<AppState>` 通过 axum 的 `State` extractor 注入每个 handler。

## 5. 路由层（web/routes.rs）

handler 的固定形态：

```rust
async fn create_capsule(
    State(state): S,                                        // Arc<AppState>
    headers: HeaderMap,                                     // 鉴权用
    payload: Result<Json<CreateCapsuleRequest>, JsonRejection>,  // 显式接住解码失败
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;      // 401 由 ? 上抛
    let req = body(payload)?;                               // 坏 JSON → 422
    Ok(envelope::ok_with(StatusCode::CREATED, capsule::create(&state, &user, &req).await?))
}
```

三个关键约定：

1. **请求体 DTO 字段全 `Option`**（`requests.rs`）：缺字段不在解码层失败，
   由 `validation.rs` 统一裁决成契约要求的 422 + `details`。解码层只拦"坏 JSON /
   字段类型不符"，经 `body()` 转成 `details=[("body", ...)]` 的 422。
2. **查询参数用 `HashMap<String, String>`** 手动解析：`int_param` 区分
   "缺失 → 默认值"和"存在但非整数 → 422"（`Query<struct>` 做不到这件事）。
3. **axum 0.8 路径参数语法是 `{param}`**（0.7 的 `/:param` 已废弃）。

未匹配路由走 `.fallback()` → 404 NOT_FOUND 外壳。

## 6. 错误模型（web/error.rs）

`ApiError { status, code, message, details }` 实现 `IntoResponse`，
所以 `ApiResult<Response>` 的 handler 里任何 `?` 都直接产出契约错误外壳：

```
422 VALIDATION_ERROR（带 details[{field,message}]）
401 UNAUTHORIZED / 403 FORBIDDEN / 404 NOT_FOUND
409 CONFLICT（带 details）/ 400 BAD_REQUEST / 429 RATE_LIMITED
500 INTERNAL_ERROR（对外隐藏细节，tracing 记录原始信息）
```

与 Vapor 对照：那边是中间件 catch + 转换，这边是类型系统直接表达——
没有"漏接异常"的可能，`Result` 不处理编译不过。

## 7. 跨库数据层（infra/db.rs）—— 本实现的核心

### 7.1 一份 SQL，两个驱动

业务 SQL 用 `?` 占位写一份；PG 执行前由 `to_pg_placeholders` 顺序替换为 `$1..$n`
（约定 SQL 文本不含字面 `?`，所有值都走绑定，替换是安全的）。

### 7.2 绑定：Value 枚举

| Value | PostgreSQL 绑定 | SQLite 绑定 |
|---|---|---|
| `Uuid(u)` | 原生 `uuid::Uuid` | 32 位无横线 hex TEXT |
| `Ts(t)` | 原生 `DateTime<Utc>`（timestamptz） | `yyyy-MM-ddTHH:mm:ss.SSSSSS+00:00` TEXT |
| `Bool(b)` | 原生 boolean | 0/1 整数 |
| `I64` / `Str` | 直传 | 直传 |

SQLite 的时间戳格式与 Python seed 的 `isoformat()` 逐字符一致——TEXT 列上
字符串比较即时间比较，`open_at <= ?` 过滤和 `ORDER BY created_at` 不需要任何函数转换。

### 7.3 读取：Cell 枚举 + DbRow 访问器

行解码成驱动无关的 `Cell`（PG 按列类型名 UUID/TIMESTAMPTZ/BOOL/INT4/INT8…分发；
SQLite 按**值的实际存储类**分发——列声明类型对 `COUNT(*)`、`(a IS NOT NULL)` 这类
表达式不可靠）。`DbRow` 的访问器按 Cell 形态还原：

```rust
row.uuid("id")      // Cell::Uuid 直取；Cell::Str 按 hex/带横线解析
row.ts("open_at")   // Cell::Ts 直取；Cell::Str 走 iso_date::parse
row.bool("in_plaza")// Cell::Bool 直取；Cell::I64 按 !=0
```

访问器是 **cell-driven** 而非 driver-driven：同一段仓储代码不需要知道自己跑在哪个库上。

### 7.4 连接与事务

- PG：`PgPool`（max 8），`FOR UPDATE` 行锁可用。
- SQLite：`SqlitePool` **max_connections(1)** —— 池本身就是串行门闩
  （对应 Vapor 的 AsyncGate actor、Ktor 的池=1）；`busy_timeout=5s`、`foreign_keys=ON`。
- 事务不走 sqlx 的 `Transaction` 类型（它会让连接类型在 enum 两臂分叉），
  而是显式 `BEGIN` / `BEGIN IMMEDIATE` + `conn.finish(result)`：

```rust
let mut conn = state.db.begin().await?;
let result = async { /* 多步操作，可 ? 提前退出 */ }.await;
conn.finish(result).await    // Ok → COMMIT，Err → ROLLBACK
```

**纪律**：一个 service 公共方法只 acquire 一次连接；绝不同时持有两个
（SQLite 池上限 1 会自锁）。鉴权的 `required_user` 在 handler 层先取先还，
随后 service 再取，时序上是串行的。

## 8. 仓储与服务层

仓储（`infra/repos.rs`）按表分模块（`users` / `capsules` / `favorites` / `refresh_tokens`），
函数签名统一 `async fn xxx(conn: &mut Conn, ...) -> ApiResult<T>`——事务边界完全由
service 决定，仓储自身不开事务。

值得注意的查询：

- `capsules::find_plaza_page`：登录时 `LEFT JOIN favorites` 一次带出 `favorited_by_me`，
  无 N+1；匿名时 `(1 = 0) AS favorited_by_me` 占位。
- `favorites::insert_ignore`：`INSERT ... ON CONFLICT DO NOTHING RETURNING created_at`，
  返回行存在与否即"是否真插入"——一条语句完成幂等判定。
- `refresh_tokens::find_by_token_hash_for_update`：PG 拼 ` FOR UPDATE`，SQLite 省略
  （单连接天然串行）。这是仓储里唯一一处 driver 分支。

## 9. 事务一致性两案例

### 9.1 收藏计数（services/favorite.rs）

`favorite_count` 是冗余计数器。增量路径在一个事务里：UPSERT 判真插入 → 原子
`favorite_count = favorite_count + 1` → 读回最新值。并发下不重复计数
（契约用例：5 并发收藏 → 计数恰为 5）。重复收藏幂等返回原 `favoritedAt`。

### 9.2 refresh 轮转（services/auth.rs）

重用检测（拿旧 token 再刷）必须**先提交家族吊销、再返回 401**——若在事务内抛错，
PG 会把吊销一起回滚，留下安全缺口。实现：事务体不抛业务错，返回
`RefreshOutcome::{Success, Invalid, Reused}`，`conn.finish` COMMIT 之后再把
Invalid/Reused 转成 401。等价于 Spring 的 `noRollbackFor`、Vapor 的同名 outcome 模式。

## 10. 鉴权与安全（services/security.rs, web/auth.rs)

- **JWT HS256 手写**：`base64url(header).base64url(payload).base64url(HMAC-SHA256)`。
  校验顺序：形态 → 签名（`Mac::verify_slice`，常数时间）→ payload 解析 → `exp`。
  过期返回 `access_token_expired`，其余一律 `invalid_token`（契约区分这两个 message）。
- **refresh token**：32 字节随机 → base64url 下发；落库只存 SHA-256 hex。
- **bcrypt**：cost 10，`$2b$` 与 Python seed 互验。
- **登录限流**：每邮箱 60 秒窗口 10 次失败 → 429（进程内存实现，教学项目不做分布式）。
- `optional_user`：坏 token 静默当匿名；`required_user`：缺失/过期/非法分别给出对应 message。

## 11. 校验（services/validation.rs）

对齐 `spec/openapi.yaml`：email 格式 + ≤254、密码 8-128 含字母数字、昵称
`[\p{L}\p{N}_-]{2,20}`、标题 1-60 字符、正文 1-5000、code 8 位字母数字、
page≥1 / pageSize 1-50。长度一律按 **字符**（`chars().count()`）不按字节——
CJK 内容下字节数会虚高 3 倍。

**Rust 特有**：regex crate 不支持 lookahead，密码的
`(?=.*[A-Za-z])(?=.*\d)` 改为显式 `any(is_ascii_alphabetic)` + `any(is_ascii_digit)` 扫描。

## 12. LLM 客户端（services/llm.rs）

- **日志规范**（CLAUDE.md 要求）：请求前 INFO `LLM request model= url=`；
  成功 INFO `LLM response model= elapsed_ms= tokens=`（usage 缺失记 n/a）；
  失败 WARN `LLM error model= elapsed_ms= status=/error=`。
- **重试策略**：只重试 reqwest 传输层错误（网关 SSL EOF 一类瞬时故障，退避递增）；
  HTTP 4xx/5xx 与坏 JSON 不重试。
- **api_style**：`chat`（默认）/ `responses` / `auto`（responses 失败回落 chat）。
  chat 路径带 `thinking: {type: disabled}`，网关 400 不认时去掉重试一次。
- **UA 伪装**：默认 Chrome UA，避开 Cloudflare 1010。
- 输出解析：剥 ``` 围栏 → 整体 parse → 失败截取首尾 `{}` 再试。
- 建议端点失败走本地模板兜底（`generatedBy=local-template`）；
  推荐端点失败返回空列表（`generatedBy=none`），不兜底不报错——按 spec 的定位区分。

## 13. 测试（./test）

25 个纯函数单元测试，无数据库依赖：iso_date 解析变体/往返/排序、validation 规则、
JWT 往返/过期/篡改、refresh token 形态、UUID hex 往返、`?`→`$n` 转换、
8 位码生成、推荐解析去重/钳位、标题清洗、本地兜底。
契约行为（104 用例）由 `verification/` 黑盒覆盖，不在单元层重复。

## 14. 改代码从哪里下手

| 想改什么 | 动哪里 |
|---|---|
| 新增端点 | `web/routes.rs` 注册 + handler；业务进 `services/` |
| 新增字段校验 | `services/validation.rs`（对照 spec/openapi.yaml） |
| 新增表/查询 | `infra/repos.rs` 加模块函数；跨库类型走 Value/Cell，别绕过 |
| 改响应结构 | `services/mapper.rs`（注意显式 null 字段） |
| 换 LLM 网关 | 环境变量即可（LLM_BASE_URL/MODEL/API_STYLE）；解析逻辑在 `services/llm.rs` |
| 调事务边界 | service 层 begin/finish；仓储不开事务的约定不要破 |

## 15. 推荐阅读顺序

1. `main.rs` + `state.rs`（5 分钟，骨架）
2. `web/routes.rs` 任挑一个 handler 跟到底（请求流）
3. `infra/db.rs`（跨库核心，重点 Value/Cell 与 finish 模式）
4. `services/auth.rs` 的 `refresh`（事务一致性的代表作）
5. `services/favorite.rs`（UPSERT 幂等计数）
6. 其余按需。
