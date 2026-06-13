# HelloTime Pro Axum 后端技术手册与代码导读

本文面向已经熟悉 Rust 基本语法（所有权/借用、`Result`/`?`、`enum`/`match`、trait、`async`/`await`），
但还没系统接触过 **Axum / Tokio / sqlx** 这套服务端技术栈的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Axum 后端后，代码按什么顺序执行、错误如何沿 `?` 冒泡成响应。
- Axum / Tokio、sqlx（不用宏）、自研 `Value`/`Cell` 编解码层分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：§1～§4 建立选型、地图、入口认识；**§5 是钥匙**——讲清 Rust/Axum 的几个核心机制
> （extractor 提参、`?` + `IntoResponse` 让错误处理变成类型问题、`Arc<AppState>` 注入）；§6～§9 按请求生命周期分层；
> 其中 **§7 的 `Value`/`Cell` 跨库层**是这个实现最值得读的部分；§13 用一次注册请求把全链路串起来。

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

端口 **29070**（见根 `CLAUDE.md` 端口分配）。

**为什么不用 `sqlx::Any` 驱动？** Any 驱动的类型推断有限，PG 的 `uuid`/`timestamptz`
列用文本协议绑定需要在 SQL 里逐处 `::uuid` 强转，SQL 文本就不再是"一份"。
自研 `Value`/`Cell` 编解码层把差异收敛到绑定/读取两个点，SQL 完全共享。

## 2. 目录地图

Axum 后端的职责：提供 `/api/v1/*` HTTP API、校验请求、处理注册/登录/JWT/refresh 轮转、
读写用户/胶囊/收藏并维护 `favorite_count`、在 PostgreSQL 与 SQLite 间无缝切换、暴露 `spec/` 静态资源、
提供 LLM 建议/推荐接口。

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
    user.rs / capsule.rs / plaza.rs / favorite.rs / mapper.rs
    llm.rs / suggestion.rs / recommendation.rs / avatar.rs
  infra/
    db.rs              Db / Conn / Value / Cell / DbRow —— 跨库核心
    repos.rs           users / capsules / favorites / refresh_tokens 仓储
    iso_date.rs        ISO-8601 解析与两种输出格式
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Tokio 异步运行时 + Axum Router（按路径匹配 + .fallback() 兜 404）
  ▼
handler（async fn）── extractor 提参：State / HeaderMap / Result<Json<T>, JsonRejection> / Query
  │ required_user(&state,&headers).await?   鉴权（缺失/过期 → 401，? 上抛）
  ▼
services/*.rs（async fn → ApiResult<Value>）
  │ state.db.begin() → 业务（可 ?）→ conn.finish(result)
  ▼
infra/repos.rs → infra/db.rs
  │ 一份 SQL（? 占位，PG 端转 $n），Value 绑定 / Cell 读取
  ▼
PostgreSQL（连接池 8）或 SQLite（池上限 1，天然串行）
```

返回方向：service 返回 `serde_json::Value`，handler 用 `envelope::ok(...)` 包成功外壳；
任何 `ApiError`（实现了 `IntoResponse`）经 `?` 直接变成契约错误外壳。

## 3. 运行与验证

```bash
cd backends/axum
./build                                                 # 预热（首次 4-5 分钟）
./run                                                   # DB_DRIVER=postgres（默认）
DB_DRIVER=sqlite ./run                                  # SQLite，零外部依赖
./test                                                  # 25 个纯函数单元测试
../../verification/scripts/verify-contract.sh axum          # 契约 104 用例（PG）
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh axum
```

首次 `./build` 慢（Rust 全量编译 + 依赖）；`run` 不建表/迁移/seed——schema 由 `scripts/db` 准备。

## 4. 入口与状态装配（main.rs / state.rs）

`main.rs` 顺序：tracing（`LOG_LEVEL` 默认 info，`warning`→`warn` 归一）→
`AppConfig::from_environment()` → `AppState::build()` → `Router` + `CorsLayer::permissive()` → `axum::serve`：

```rust
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::new(level)).init();
    let config = AppConfig::from_environment();
    let state = Arc::new(AppState::build(config).unwrap_or_else(|e| { eprintln!("启动失败: {e}"); exit(1) }));
    let app = web::routes::router(state).layer(CorsLayer::permissive());
    let listener = TcpListener::bind(&addr).await...;
    axum::serve(listener, app).await...;
}
```

`AppState`（`state.rs`）手动装配，全部字段启动时就绪，最后 `Arc<AppState>` 通过 axum 的 `State` extractor 注入每个 handler：

- `Db`：按 `DB_DRIVER`/`DB_URL` 建 PgPool（lazy，max 8）或 SqlitePool（max **1**）。lazy 连接意味着启动不依赖数据库可达。
- `AvatarService`：读 `spec/avatars/catalog.json` 一次。
- `reqwest::Client`、prompt 模板、`LoginRateLimiter`（`Mutex<HashMap<email, Vec<Instant>>>` 60 秒滑动窗口）。

## 5. Rust / Axum 的几个关键思想

Axum 把"Rust 类型系统"用作正确性工具。看懂下面三件事，全篇剩下的都是常规 Rust。

### 5.1 handler = `async fn` + extractor 提参

Axum 的 handler 是普通 `async fn`，参数是一组 **extractor**——Axum 按类型从请求里提取对应数据：

```rust
async fn create_capsule(
    State(state): State<Arc<AppState>>,                          // 共享状态
    headers: HeaderMap,                                          // 鉴权用
    payload: Result<Json<CreateCapsuleRequest>, JsonRejection>,  // 显式接住解码失败
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;           // 401 由 ? 上抛
    let req = body(payload)?;                                    // 坏 JSON → 422
    Ok(envelope::ok_with(StatusCode::CREATED, capsule::create(&state, &user, &req).await?))
}
```

三个关键约定：

1. **请求体 DTO 字段全 `Option`**（`requests.rs`）：缺字段不在解码层失败，由 `validation.rs` 统一裁决成契约要求的
   422 + `details`。把解码失败显式接成 `Result<Json<T>, JsonRejection>`，再经 `body()` 转 `details=[("body",...)]` 的 422。
2. **查询参数用 `Query<HashMap<String, String>>`** 手动解析：`int_param` 区分"缺失 → 默认值"和"存在但非整数 → 422"
   （`Query<struct>` 直接反序列化做不到这件事）。
3. **axum 0.8 路径参数语法是 `{param}`**（0.7 的 `/:param` 已废弃）。未匹配走 `.fallback()` → 404 外壳。

### 5.2 `?` + `IntoResponse`：错误处理变成类型问题

`ApiError` 实现了 `IntoResponse`，所以返回 `ApiResult<Response>`（即 `Result<Response, ApiError>`）的 handler 里，
任何 `?` 都直接产出契约错误外壳：

```rust
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        envelope::error(self.status, self.code, &self.message, self.details.as_deref())
    }
}
```

这意味着 **"漏接异常"在 Rust 里编译不过**——`Result` 不处理就有警告/类型不符，service 里 `repo(...).await?` 一路把
`ApiError` 冒泡到 handler，由 Axum 调 `into_response()`。与 Vapor 的"中间件 catch 转换"对照：那边是运行时兜底，
这边是类型系统直接表达，没有"忘了捕获"的可能。`ApiError` 的工厂方法对应 8 个 errorCode（`validation/unauthorized/
forbidden/not_found/conflict/bad_request/rate_limited/internal`），`internal` 还会 `tracing::error!` 记录原始信息但对外只回"服务器内部错误"。

### 5.3 `Arc<AppState>` 共享、`Send + Sync` 是硬约束

`AppState` 用 `Arc` 包起来注入每个 handler，跨 `.await` 点和 Tokio 任务共享。Rust 要求跨 await 的状态满足
`Send + Sync`——这就是为什么 `LoginRateLimiter` 用 `Mutex<HashMap<...>>`（而不是裸 HashMap）、`Db` 内部用连接池：
编译器强制你把共享可变状态做成线程安全的，否则不编译。

## 6. 错误模型（web/error.rs）

`ApiError { status, code, message, details }` 实现 `IntoResponse`（§5.2）：

```
422 VALIDATION_ERROR（带 details[{field,message}]）
401 UNAUTHORIZED / 403 FORBIDDEN / 404 NOT_FOUND
409 CONFLICT（带 details）/ 400 BAD_REQUEST / 429 RATE_LIMITED
500 INTERNAL_ERROR（对外隐藏细节，tracing 记录原始信息）
```

请求体解码失败由 `body()` 辅助函数转成 422 `invalid_body`（`details=[("body","请求体格式不合法")]`）。

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

SQLite 的时间戳格式与 Python seed 的 `isoformat()` 逐字符一致——TEXT 列上字符串比较即时间比较，
`open_at <= ?` 过滤和 `ORDER BY created_at` 不需要任何函数转换。

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

两边解码的**不对称**值得理解（`decode_pg_row` / `decode_sqlite_row`）：

- **PG 侧**列类型信息完整，解码时就把 `UUID`/`TIMESTAMPTZ`/`BOOL`/`INT2|4|8`/`FLOAT4|8`
  分别还原成 `Cell::Uuid`/`Ts`/`Bool`/`I64`/`F64`。
- **SQLite 侧**只有 INTEGER / REAL / TEXT 三种存储类，UUID / 时间戳 / 布尔统统落进
  `Cell::Str` 或 `Cell::I64`——再由访问器 `row.uuid`/`row.ts`/`row.bool` 按目标类型反解
  （hex→UUID、ISO→时间、`!=0`→bool）。

所以**同一行在两个库里 `Cell` 形态不同**，但访问器把差异收口在读取这一点——仓储与
service 完全看不到驱动差异。这也解释了为什么按"值的实际存储类"而非"列声明类型"分发：
`COUNT(*)`、`(x IS NOT NULL)` 这类表达式列在 SQLite 里没有可靠的声明类型。

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

**纪律**：一个 service 公共方法只 acquire 一次连接；绝不同时持有两个（SQLite 池上限 1 会自锁）。
鉴权的 `required_user` 在 handler 层先取先还，随后 service 再取，时序上是串行的。

## 8. 仓储与服务层

仓储（`infra/repos.rs`）按表分模块（`users` / `capsules` / `favorites` / `refresh_tokens`），
函数签名统一 `async fn xxx(conn: &mut Conn, ...) -> ApiResult<T>`——事务边界完全由 service 决定，仓储自身不开事务。

值得注意的查询：

- `capsules::find_plaza_page`：登录时 `LEFT JOIN favorites` 一次带出 `favorited_by_me`，无 N+1；匿名时 `(1 = 0) AS favorited_by_me` 占位。
- `favorites::insert_ignore`：`INSERT ... ON CONFLICT DO NOTHING RETURNING created_at`，返回行存在与否即"是否真插入"——一条语句完成幂等判定。
- `refresh_tokens::find_by_token_hash_for_update`：PG 拼 ` FOR UPDATE`，SQLite 省略（单连接天然串行）。这是仓储里唯一一处 driver 分支。

## 9. 事务一致性两案例

### 9.1 收藏计数（services/favorite.rs）

`favorite_count` 是冗余计数器。增量路径在一个事务里：UPSERT 判真插入 → 原子 `favorite_count = favorite_count + 1` → 读回最新值：

```rust
let inserted = favorites::insert_ignore(&mut conn, &user.id, &capsule.id, &now).await?;
let favorited_at = if inserted {
    capsules::increment_favorite_count(&mut conn, &capsule.id, &now).await?;  // 真插入才 +1
    now
} else {
    favorites::find(&mut conn, &user.id, &capsule.id).await?.unwrap_or(now)   // 已收藏：幂等回读
};
```

并发下不重复计数（契约用例：5 并发收藏 → 计数恰为 5）。取消收藏对称：`DELETE` 判 `deleted` 真删才 `-1`。

### 9.2 refresh 轮转（services/auth.rs）

重用检测（拿旧 token 再刷）必须**先提交家族吊销、再返回 401**——若在事务内抛错，
PG 会把吊销一起回滚，留下安全缺口。实现：事务体不抛业务错，返回 `RefreshOutcome::{Success, Invalid, Reused}`，
`conn.finish` COMMIT 之后再把 Invalid/Reused 转成 401。等价于 Spring 的 `noRollbackFor`、Vapor 的同名 outcome 模式。

`login` 也用了同样的手法：事务返回 `ApiResult<Option<Value>>`，"用户不存在/密码错"在事务内返回 `Ok(None)`（干净提交），
出事务后再 `record_failure` + 抛 401——把失败计数放在提交之后，而不是当成事务内异常。

## 10. 鉴权与安全（services/security.rs, web/auth.rs）

- **JWT HS256 手写**：`base64url(header).base64url(payload).base64url(HMAC-SHA256)`（`hmac` + `sha2` crate）：

```rust
let signing_input = format!("{header}.{body}");
let mut mac = HmacSha256::new_from_slice(config.jwt_secret.as_bytes()).unwrap();
mac.update(signing_input.as_bytes());
let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
```

  校验顺序：形态 → 签名（`mac.verify_slice`，常数时间）→ payload 解析 → `exp`。
  过期返回 `access_token_expired`，其余一律 `invalid_token`（契约区分这两个 message）。
- **refresh token**：32 字节随机 → base64url 下发；落库只存 SHA-256 hex。
- **bcrypt**：`bcrypt` crate，cost 10，`$2b$` 与 Python seed 互验。
- **登录限流**：每邮箱 60 秒窗口 10 次失败 → 429（`Mutex<HashMap>` 进程内存实现）。
- `optional_user`：坏 token 静默当匿名；`required_user`：缺失/过期/非法分别给出对应 message。

## 11. 校验（services/validation.rs）

对齐 `spec/openapi.yaml`：email 格式 + ≤254、密码 8-128 含字母数字、昵称 `[\p{L}\p{N}_-]{2,20}`、
标题 1-60 字符、正文 1-5000、code 8 位、page≥1 / pageSize 1-50。长度一律按 **字符**（`chars().count()`）不按字节——
CJK 内容下字节数会虚高 3 倍。

**Rust 特有**：regex crate 不支持 lookahead，密码的 `(?=.*[A-Za-z])(?=.*\d)` 改为显式
`any(is_ascii_alphabetic)` + `any(is_ascii_digit)` 扫描。

## 12. LLM 客户端（services/llm.rs）

- **日志规范**（CLAUDE.md 要求）：请求前 INFO `LLM request model= url=`；成功 INFO `LLM response model= elapsed_ms= tokens=`
  （usage 缺失记 n/a）；失败 WARN `LLM error model= elapsed_ms= status=/error=`。
- **重试策略**：只重试 reqwest 传输层错误（网关 SSL EOF 一类瞬时故障，退避递增）；HTTP 4xx/5xx 与坏 JSON 不重试。
- **api_style**：`chat`（默认）/ `responses` / `auto`（responses 失败回落 chat）。chat 路径带 `thinking: {type: disabled}`，网关 400 不认时去掉重试一次。
- **UA 伪装**：默认 Chrome UA，避开 Cloudflare 1010。
- 建议端点失败走本地模板兜底（`generatedBy=local-template`）；推荐端点失败返回空列表（`generatedBy=none`），按 spec 的定位区分。

## 13. 从真实请求读代码：`POST /api/v1/auth/register`

把前面各层串起来，跟一次注册走到底（`services/auth.rs` 的 `register`）：

```rust
pub async fn register(state: &AppState, req: &RegisterRequest) -> ApiResult<Value> {
    // ① 校验（validation）：缺字段/格式错返回 Err(ApiError)，经 ? 上抛成 422
    let email = validation::email(req.email.as_deref())?.to_lowercase();
    let raw_password = validation::password(req.password.as_deref(), "password")?;
    let nickname = validation::nickname(req.nickname.as_deref())?;
    let avatar_id = validation::avatar_format(req.avatar_id.as_deref())?;
    if !state.avatars.exists(&avatar_id) { return Err(ApiError::validation("头像 ID 不存在", "avatarId")); }
    let password_hash = security::hash_password(&raw_password).map_err(ApiError::internal)?;  // ② bcrypt（事务外）

    let mut conn = state.db.begin().await?;                          // ③ 开事务
    let result = async {
        if users::exists_by_email(&mut conn, &email).await? { return Err(ApiError::conflict("邮箱已被注册", "email")); }
        if users::exists_by_nickname(&mut conn, &nickname).await? { return Err(ApiError::conflict("昵称已被使用", "nickname")); }
        let user = User { id: Uuid::new_v4(), email, password_hash, nickname, avatar_id, created_at: now, updated_at: now };
        users::insert(&mut conn, &user).await?;                      // ④
        issue_token_pair(state, &mut conn, &user, None).await        // ⑤ 签发并落库 refresh
    }.await;
    conn.finish(result).await                                        // ⑥ Ok → COMMIT，Err → ROLLBACK
}
```

请求回到 `routes.rs` 的 handler：`envelope::ok_with(StatusCode::CREATED, ...)` 包成 201 响应。
全链路标准姿势：**校验（`?` 上抛 422）→ 慢哈希放事务外 → `begin()` → async 块里做 IO（`?` 提前退出）→ `finish(result)` 统一收尾**。
注意 ⑥：业务块返回的 `Result` 交给 `finish`，它据此 COMMIT 或 ROLLBACK——错误路径不用手写回滚，类型系统替你保证了"要么提交要么回滚"。

## 14. 测试（./test）

25 个纯函数单元测试，无数据库依赖：iso_date 解析变体/往返/排序、validation 规则、JWT 往返/过期/篡改、
refresh token 形态、UUID hex 往返、`?`→`$n` 转换、8 位码生成、推荐解析去重/钳位、标题清洗、本地兜底。
（这些测试就内联在各模块的 `#[cfg(test)] mod tests` 里，例如 `security.rs` 末尾的 JWT 往返/过期/篡改三例。）
契约行为（104 用例）由 `verification/` 黑盒覆盖，不在单元层重复。

## 15. 改代码从哪里下手

| 想改什么 | 动哪里 |
|---|---|
| 新增端点 | `web/routes.rs` 注册 + handler；业务进 `services/` |
| 新增字段校验 | `services/validation.rs`（对照 spec/openapi.yaml） |
| 新增表/查询 | `infra/repos.rs` 加模块函数；跨库类型走 Value/Cell，别绕过 |
| 改响应结构 | `services/mapper.rs`（注意显式 null 字段） |
| 换 LLM 网关 | 环境变量即可（LLM_BASE_URL/MODEL/API_STYLE）；解析逻辑在 `services/llm.rs` |
| 调事务边界 | service 层 begin/finish；仓储不开事务的约定不要破 |

## 16. 学到这里之后

读到这里，你已经掌握了这个 Rust 后端最关键的部分：extractor 提参、**`?` + `IntoResponse` 让漏接错误编译不过**、
`Arc<AppState>` + `Send + Sync` 约束、自研 `Value`/`Cell` 跨库编解码、`begin/finish` 显式事务 + outcome 枚举。

下一步建议：

- 跟着 §13 的注册链路，把 `login`（Option-in-transaction）和 `refresh`（RefreshOutcome）也读一遍，
  体会"为什么有些失败要在事务内返回值、事务外才转成错误"。
- 重点精读 §7 的 `db.rs`——`Value`/`Cell` 双枚举是"用类型把跨库差异收口在两个点"的范例。
- 把本实现的类型化跨库（`Value`/`Cell`）和 `backends/drogon`（纯文本协议）、`backends/spring-boot`
  （`@JdbcType` + 自实现 ValueBinder）并排读——同一道题，三种抽象层次的解法。

之后可深入 Rust 异步/Web 进阶：`tower` 中间件（本项目只用了 CorsLayer）、sqlx 的编译期 `query!` 宏
（单库场景下的强类型）、`sqlx::Any` 的取舍。本实现刻意只用运行时 `sqlx::query`，把这些留给后续。

## 17. 推荐阅读顺序

1. `main.rs` + `state.rs`（5 分钟，骨架）
2. **§5**（Rust/Axum 三件事）配合 `web/routes.rs` 任挑一个 handler 跟到底（extractor → service → envelope）
3. `infra/db.rs`（跨库核心，重点 Value/Cell 与 finish 模式，§7）
4. `services/auth.rs` 的 `register`/`refresh`（事务一致性的代表作，配合 §13）
5. `services/favorite.rs`（UPSERT 幂等计数）
6. 其余按需。
