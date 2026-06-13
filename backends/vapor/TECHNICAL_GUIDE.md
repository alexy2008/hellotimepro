# HelloTime Pro Vapor 后端技术手册与代码导读

本文面向已经熟悉 Swift 基本语法（`struct`/`enum`/`actor`、`async`/`await`、`Optional`、闭包、协议），
但还没系统接触过 **Vapor / SwiftNIO** 这套服务端技术栈的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Vapor 后端后，代码按什么顺序、在哪个并发域执行。
- Vapor / SwiftNIO、SQLKit、swift-crypto、actor 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：§1～§4 建立选型、地图、入口认识；**§5 是钥匙**——讲清 Swift 并发在这个后端里的几个核心机制
> （全链路 `async`/`await`、用 actor 收纳共享状态、值类型依赖装配、手工 JSON 树）；§6～§11 按请求生命周期分层；
> 其中 **§7 的 `AsyncGate` 门闩**是这个实现最值得读的 50 行；§13 用一次注册请求把全链路串起来。

---

## 1. 技术选型与设计特色

- **Vapor 4 + SwiftNIO**：Swift 服务端事实标准框架。HTTP 由 SwiftNIO 事件循环承载，
  路由处理器全部是 `async throws` 函数，async/await 全链路异步。
- **SQLKit 手写 SQL，不用 Fluent ORM**：本项目 schema 由 `spec/db` 外部管理（后端不迁移、不建表），
  且 SQLite/PG 的列表示差异大（hex TEXT vs 原生 uuid）。SQLKit 的参数化 `raw` SQL +
  自建跨库编解码层比 Fluent 模型映射更直接、更可教学。
- **手写 JWT（HS256）**：签发/校验各约 20 行（swift-crypto 的 HMAC + base64url），
  省掉 jwt-kit 依赖树；refresh token 是不透明随机串，只存 SHA-256。
- **手工 JSON 树输出**：`JSON` 枚举（`Web/Json.swift`）替代 Codable 合成——契约要求
  `data`/`errorCode`/`content` 等字段输出**显式 null**，而 Swift 合成 Encodable 对
  Optional 走 `encodeIfPresent` 直接丢键。
- **Swift 5 语言模式**：`Package.swift` 不开 Swift 6 严格并发（教学项目，降低噪音）。

端口 **29060**（见根 `CLAUDE.md` 端口分配）。

## 2. 先建立整体地图

Vapor 后端的职责：提供 `/api/v1/*` HTTP API、校验请求、处理注册/登录/JWT/refresh 轮转、
读写用户/胶囊/收藏并维护 `favorite_count`、在 PostgreSQL 与 SQLite 间无缝切换、暴露 `spec/` 静态资源、
提供 LLM 建议/推荐接口。

```
backends/vapor/
  run / build / test          ← 运维入口（hello CLI 调 run）
  server/                     ← Swift 包（见下方"目录为什么叫 server"）
    Package.swift             ← Vapor + SQLKit + PostgresKit + SQLiteKit
    Sources/App/
      entrypoint.swift        ← @main：Environment.detect → configure → execute
      AppComponents.swift     ← 手动依赖装配
      Config/AppConfig.swift  ← 环境变量 → 配置结构体
      Web/
        Routes.swift          ← 全部路由集中注册（presentation）
        ApiError.swift        ← 业务异常 + 错误中间件（统一错误外壳）
        Envelope.swift        ← 成功/失败响应构造
        Json.swift            ← JSON 枚举树（显式 null 的根源）
        Requests.swift        ← 请求体 DTO（字段全可选，校验层裁决）
        AuthContext.swift     ← Bearer 解析 → 当前用户
      Services/               ← 业务逻辑（application 层）
        Validation / SecurityService / AuthService / UserService /
        CapsuleService / PlazaService / FavoriteService / AvatarService /
        LlmClient / SuggestionService / RecommendationService / MapperService
      Infra/
        Database.swift        ← AppDatabase：连接、事务、跨库编解码、AsyncGate
        Repositories.swift    ← 四个仓储（users/capsules/favorites/refresh_tokens）
        IsoDate.swift         ← ISO-8601 解析/格式化（SQLite TEXT 约定）
      Domain/Models.swift     ← User / Capsule / CapsuleView / RefreshTokenRow
    Tests/AppTests/           ← 纯函数单元测试（无需数据库）
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
SwiftNIO 事件循环
  ▼
中间件栈：CORSMiddleware → ApiErrorMiddleware（自定义，统一错误外壳）
  ▼
Routes.swift 的 async 闭包
  │ authContext.required(req) / optional(req)   解析 Bearer
  │ req.content.decode(...)  反序列化；intParam 取分页
  ▼
Services/*.swift（async throws）
  │ db.transaction { sql in ... }   多步操作原子
  ▼
Infra/Repositories.swift → AppDatabase
  │ SQLKit raw SQL + 跨库编解码助手
  ▼
PostgreSQL（连接池）或 SQLite（单连接 + AsyncGate 串行）
```

**目录为什么叫 server**：SwiftPM 的**根包身份取自所在目录名**。如果包直接放在
`backends/vapor/`，根包身份 `vapor` 会与依赖包 `vapor`（来自 vapor/vapor.git）同名，
SwiftPM 报 `cyclic dependency between packages`。挪进 `server/` 子目录即可（身份变成 `server`）。

## 3. 如何运行和验证

```bash
./scripts/db reset --seed                  # schema + 演示数据（后端自身不建表）
./scripts/hello start vapor                # 注入 DB_DRIVER/DB_URL/LLM_*
curl -s localhost:29060/api/v1/health | python3 -m json.tool

./verification/scripts/verify-contract.sh vapor                   # 契约 104 用例（PG）
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh vapor  # SQLite

cd backends/vapor && ./test                # 13 个纯函数单元测试
```

冷启动注意：`run` 里有增量 `swift build -c release`。第一次必须先 `./build` 预热
（冷 release 编译数分钟），否则契约脚本 60s 就绪窗口会超时。

## 4. 入口与配置：`entrypoint.swift` + `Config/AppConfig.swift`

`@main` 流程：`Environment.detect()` → `LoggingSystem.bootstrap` → `Application.make` → `configure` → `execute`。

`configure` 做四件事，注意第 3 步——**重置中间件栈**是这个实现对齐契约的关键：

```swift
func configure(_ app: Application) async throws {
    let config = AppConfig.fromEnvironment()
    app.http.server.configuration.port = config.port           // ① 默认 29060（hello 不注入 PORT）
    app.http.client.configuration.timeout = .init(...)         // ② LLM 客户端超时

    app.middleware = .init()                                   // ③ 丢掉 Vapor 默认 ErrorMiddleware
    app.middleware.use(CORSMiddleware(configuration: .init(...)))  //    （它的错误 JSON 不是契约外壳）
    app.middleware.use(ApiErrorMiddleware())                   //    换成 CORS + 自研错误中间件

    let db = try await AppDatabase(app: app, config: config)   // ④ 建库 → 装配 → 注册路由
    app.lifecycle.use(DatabaseShutdown(db: db))                //    进程退出回收连接
    let components = try AppComponents(app: app, config: config, db: db)
    registerRoutes(app, components)
}
```

`AppConfig` 全部来自环境变量（带默认值），只负责把运行时开关收敛成强类型配置。
`PORT` 默认 29060——hello CLI 不注入 PORT，所以默认值必须就是登记端口。

## 5. Swift / Vapor 的几个关键思想

Vapor 把"服务端 + Swift 并发"组合得很地道。看懂下面四件事，全篇剩下的都是常规 Swift。

### 5.1 全链路 `async`/`await`，handler 是 async 闭包

路由处理器都是 `async throws` 闭包，从 handler 一路 `await` 到数据库，写法同步直观、执行全异步：

```swift
app.post("api", "v1", "capsules") { req in
    let user = try await c.authContext.required(req)               // 鉴权（缺失/过期 → 401）
    let body = try req.content.decode(CreateCapsuleRequest.self)   // 反序列化（坏 JSON → DecodingError → 422）
    return Envelope.ok(try await c.capsuleService.create(user, body), status: .created)
}
```

`app.post("api","v1","capsules")` 用**路径段数组**注册（Vapor 风格），路径参数用 `:code` 占位、
`req.parameters.get("code")` 取出。鉴权不是中间件而是**显式第一行调用**：受保护端点 `required(req)`，
匿名可带态端点（广场/胶囊详情）`optional(req)`——让鉴权边界在路由层一眼可读。

### 5.2 用 `actor` 收纳共享可变状态

Swift 并发的核心安全保证：可变状态放进 `actor`，编译器保证串行访问、无数据竞争。本实现有两个 actor：

- **`LoginRateLimiter`**（`AuthService.swift`）：每邮箱 60s 滑动窗口的失败计数，是可变 `[String:[Date]]`。
- **`AsyncGate`**（`Database.swift`，见 §7）：SQLite 单连接的 FIFO 异步门闩。

```swift
actor LoginRateLimiter {
    private var failures: [String: [Date]] = [:]
    func isLimited(_ email: String) -> Bool { /* 读改写 failures，actor 保证原子 */ }
    func recordFailure(_ email: String) { failures[email, default: []].append(Date()) }
}
```

调用方 `await rateLimiter.isLimited(email)`——`await` 是因为跨进了 actor 的隔离域。

### 5.3 值类型 struct + 构造函数注入（无 DI 容器）

`AppComponents` 手动 new 出仓储 → 服务，**除两个 actor 与 `AppDatabase`（引用类型）外全是值类型 struct**。
依赖图集中在一个文件里、源码可见，不依赖运行时扫描——适合教学。service 之间通过构造函数持有依赖：

```swift
struct AuthService: Sendable {
    let config: AppConfig; let db: AppDatabase
    let users: UserRepository; let refreshTokens: RefreshTokenRepository
    let security: SecurityService; let mapper: MapperService; ...
}
```

### 5.4 手工 `JSON` 枚举树：为什么不用 Codable 合成

契约用 strict equal 断言 `data`/`errorCode`/`content` 为**显式 `null`**，而 Swift 合成的 Encodable 对
`Optional` 走 `encodeIfPresent` **直接丢键**。所以响应一律用 `JSON` 枚举手工构造（`Web/Json.swift`）：

```swift
enum JSON: Sendable { case null, bool(Bool), int(Int), double(Double),
                      string(String), array([JSON]), object([String: JSON]) }
```

它的 `Encodable` 实现对 `.null` 调 `encodeNil()`，输出字面 `null`。`JSON` 也用来解析 LLM 返回的任意 JSON，
且 `intValue` 宽容取整（兼容 LLM 把 `openInDays` 输出成 `30.0` 或 `"30"`）。

## 6. 错误模型：`ApiError` + `ApiErrorMiddleware`

业务异常是一个轻量 struct，由静态工厂构造，对应 8 个 errorCode：

```swift
struct ApiError: Error { let status: HTTPStatus; let code: String; let message: String; let details: [...]? }
ApiError.validation("邮箱格式不正确", "email")   // 422 + details
ApiError.conflict("邮箱已被注册", "email")        // 409
ApiError.unauthorized("..."), .forbidden, .notFound, .badRequest, .rateLimited
```

`ApiErrorMiddleware`（替换 Vapor 默认 ErrorMiddleware）是统一出口，按异常类型分流：

```swift
do { return try await next.respond(to: request) }
catch let error as ApiError { return Envelope.error(error.status, code: error.code, ...) }
catch is DecodingError      { /* 坏 JSON / 类型不符 → 422 VALIDATION_ERROR + details:[("body",...)] */ }
catch let abort as AbortError { /* Vapor 内部错误映射成对应 code */ }
catch { request.logger.error(...); /* 兜底 500 INTERNAL_ERROR */ }
```

成功外壳由 `Envelope.ok(...)` 构造，`message`/`errorCode` 显式 `null`（§5.4）。

## 7. 数据库层：AppDatabase 两个原语

```swift
db.withSQL { sql in ... }       // 一个连接上执行（无显式事务）
db.transaction { sql in ... }   // BEGIN/COMMIT，异常 ROLLBACK
```

- **PostgreSQL**：`EventLoopGroupConnectionPool<PostgresConnectionSource>`，
  事务用 raw `BEGIN`/`COMMIT` 包裹同一连接（SQLKit 本身不提供跨驱动事务 API）。
- **SQLite**：**单连接 + `AsyncGate`**（actor 实现的 FIFO 异步互斥）串行化全部访问；
  事务用 `BEGIN IMMEDIATE` 直接拿写锁。
- 约定：service 公共方法只调一次 withSQL/transaction（门闩不可重入，嵌套会死锁）。

### AsyncGate：为什么是 actor 实现的 FIFO 门闩

SQLite 单连接被并发请求争用时，需要一把"异步互斥锁"——但不能用阻塞锁（会卡死
SwiftNIO 的事件循环线程）。`AsyncGate` 用 actor + `CheckedContinuation` 实现一把
**不阻塞线程、先到先得**的门闩（`Infra/Database.swift`）：

```swift
actor AsyncGate {
    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if !busy { busy = true; return }          // 空闲：直接拿锁
        await withCheckedContinuation { waiters.append($0) }  // 占用：挂起排队
    }
    func release() {
        if waiters.isEmpty { busy = false }        // 无人等：释放
        else { waiters.removeFirst().resume() }    // 有人等：FIFO 唤醒队首
    }
}
```

- **为什么是 actor**：actor 隔离让 `acquire`/`release` 里的"检查 busy + 改状态"
  天然原子，不需要再加锁。
- **为什么不阻塞**：等待者被挂起成 continuation 存进数组，事件循环线程立刻空出去干别的；
  轮到它时 `resume()` 续跑。等价于"连接池大小为 1"，但用协程挂起代替线程阻塞。
- **为什么 FIFO**：`removeFirst()` 按到达顺序唤醒，避免请求饿死。
- `withSQL` 在 do/catch 的成功与异常两条路径上都调用 `release()`（见同文件实现），否则一次抛错会永久卡死门闩。

### 跨库值编解码

业务 SQL 只写一份，差异收敛在六个助手里（绑定：`uuidValue/dateValue/boolValue`；
读取：`uuid/date/bool`）：

| 列 | SQLite | PostgreSQL |
|---|---|---|
| UUID | 32 位无横线 hex TEXT | 原生 `uuid` |
| 时间戳 | ISO-8601 TEXT：微秒 + `+00:00`（`IsoDate.sqliteString`） | 原生 `timestamptz`（绑定 `Date`） |
| 布尔 | 0/1 整数 | 原生 `boolean` |

SQLite 的 TEXT 格式与 Python seed（`isoformat()`）逐字符兼容，**同一格式下字符串比较
即时间比较**，所以 `open_at <= :now` 过滤和 `ORDER BY created_at` 在 TEXT 列上仍正确。
读取侧 `IsoDate.parse` 容忍空格分隔/可变小数位/缺省偏移，是这个实现的跨库类型适配层。

## 8. Repository 与 Service

仓储是持有 `dbx: AppDatabase`（编解码助手）的 struct，方法第一个参数都是当前连接的
`SQLDatabase`。SQL 用 SQLKit 的 `SQLQueryString` 插值（`\(bind:)` 生成参数占位符）：

```swift
func insert(_ sql: any SQLDatabase, _ user: User) async throws {
    try await sql.raw("""
        INSERT INTO users (id, email, password_hash, nickname, avatar_id, created_at, updated_at)
        VALUES (\(bind: dbx.uuidValue(user.id)), \(bind: user.email), \(bind: user.passwordHash),
                \(bind: user.nickname), \(bind: user.avatarId),
                \(bind: dbx.dateValue(user.createdAt)), \(bind: dbx.dateValue(user.updatedAt)))
        """).run()
}
```

动态片段（filter/q/排序）用 `appendLiteral`/`appendInterpolation` 增量拼接。列表查询直接 JOIN `users`
取创建者摘要（`CapsuleView`），登录用户的 `favoritedByMe` 用 `LEFT JOIN favorites ... (fv.user_id IS NOT NULL)`
一趟查完，不做 N+1。事务边界完全由 service 层的 `db.transaction { sql in ... }` 决定，仓储自身不开事务。

## 9. 事务与一致性

- **收藏计数**（`FavoriteService`）：`favorite_count` 是冗余计数器，与 favorites 行变更
  同事务。幂等性与并发正确性靠 **UPSERT 判定**——`INSERT ... ON CONFLICT DO NOTHING RETURNING created_at`
  返回行 ⇒ 真插入 ⇒ 原子 `favorite_count = favorite_count + 1`；没返回 ⇒ 已收藏 ⇒ 只回读原 `favoritedAt`。
  并发 5 连击下不重复计数（契约有专门用例）。PG/SQLite（≥3.35）此语法完全一致。
- **取消收藏**：`DELETE ... RETURNING` 判定是否真删，真删才 `-1`（带 `favorite_count > 0` 护栏）。
- **refresh 轮转**（`AuthService.refresh`）：重用检测命中时**必须先提交家族吊销再抛 401**。
  事务闭包内不抛错、返回 `RefreshOutcome` 枚举（`.success/.invalid/.reused`），`throw` 放在事务外
  （等价 Spring 的 `noRollbackFor=ApiException`）。PG 路径对 token 行加 `FOR UPDATE` 防双花。

注意 `login` 也用了同样的"事务返回 Optional、失败到事务外处理"手法：密码错时事务内返回 `nil`（干净提交），
出事务后再 `recordFailure` + 抛 401——把失败计数放在提交之后。

## 10. 鉴权与安全（SecurityService）

- **bcrypt**：Vapor 内置 `Bcrypt`（cost 10），兼容 seed 的 `$2b$` 哈希。
- **JWT HS256**（手写）：`base64url(header).base64url(payload).HMAC<SHA256>`。

```swift
func createAccessToken(user: User, now: Date = Date()) -> String {
    let payload: JSON = .object(["sub": .string(user.id.uuidString.lowercased()), ..., "exp": .int(iat + ttl)])
    let signingInput = "\(base64url(header)).\(base64url(payload))"
    let mac = HMAC<SHA256>.authenticationCode(for: Data(signingInput.utf8), using: key)
    return "\(signingInput).\(base64url(Data(mac)))"
}
```

  校验顺序：形状（3 段）→ 签名（`HMAC.isValidAuthenticationCode`，常数时间）→ 解析 payload → `exp`。
  过期返回 message `access_token_expired`、其它非法 `invalid_token`（契约对 401 message 有约定）。
- **refresh token**：32 字节随机 → base64url；库里只存 SHA-256 hex。base64url 编解码也手写在同文件。

## 11. 校验与错误处理

三层防线，全部汇入 `ApiErrorMiddleware`（§6）：

1. **请求体解码**：DTO 字段全可选（缺字段不在解码层炸），坏 JSON/类型不符抛 `DecodingError` → 422 + `details:[{field:"body"}]`；
2. **手写校验**（`Validation`）：正则/长度对齐 openapi（密码前瞻断言、昵称 `\p{L}\p{N}_-`、code 8 位等），
   抛 `ApiError.validation(message, field)` → 422 + 逐字段 details；
3. **业务异常**：`ApiError` 静态工厂对应八个 errorCode；漏网之鱼 → 500 INTERNAL_ERROR（带日志）。

## 12. LLM 客户端

`Services/LlmClient.swift`，基于 `app.client`（AsyncHTTPClient）。要点：

- **日志规范**（根 CLAUDE.md）：请求前 `LLM request model= url=`（INFO）、成功
  `LLM response model= elapsed_ms= tokens=`（INFO）、失败 `LLM error ... status=/error=`（WARNING）。
- **重试策略**：仅网络/TLS 瞬时错误重试（默认 2 次、退避 400ms×n）；HTTP 4xx/5xx 与坏 JSON 不重试。
- **API 风格**：默认 `chat`（兼容网关大多只支持它）；`responses`/`auto` 可切。
  chat 路径带 `thinking: disabled`，网关报 400 时去掉重试一次。
- **UA 伪装**：默认 Chrome UA，避开 Cloudflare 1010。
- 建议端点失败走 `local-template` 兜底（7 篇内置中文胶囊）；推荐端点失败返回空列表 `generatedBy=none`。

契约测试默认 `LLM_ENABLED=false`，客户端入口直接抛错、上层立即兜底，HTTP 路径不在测试链上。

## 13. 从真实请求读代码：`POST /api/v1/auth/register`

把前面各层串起来，跟一次注册走到底（`AuthService.register`）：

```swift
func register(_ req: RegisterRequest) async throws -> JSON {
    // ① 校验（Validation）：缺字段/格式错 → 422
    let email = try Validation.email(req.email).lowercased()
    let rawPassword = try Validation.password(req.password)
    let nickname = try Validation.nickname(req.nickname)
    let avatarId = try Validation.avatarFormat(req.avatarId)
    guard avatars.exists(avatarId) else { throw ApiError.validation("头像 ID 不存在", "avatarId") }
    let passwordHash = try security.hashPassword(rawPassword)        // ② bcrypt（事务外，慢操作）

    return try await db.transaction { sql in                        // ③ 开事务（SQLite 经 AsyncGate 串行）
        if try await users.existsByEmail(sql, email) { throw ApiError.conflict("邮箱已被注册", "email") }
        if try await users.existsByNickname(sql, nickname) { throw ApiError.conflict("昵称已被使用", "nickname") }
        let user = User(id: UUID(), email: email, passwordHash: passwordHash, ...)   // ④
        try await users.insert(sql, user)
        return try await issueTokenPair(sql, user: user, familyId: nil)              // ⑤ 签发并落库 refresh
    }   // ⑥ 闭包正常返回 → COMMIT；中途 throw → ROLLBACK（transaction 封装好了）
}
```

请求回到 `Routes.swift`：`Envelope.ok(result, status: .created)` 包成 `{success:true, data:{...}}` 的 201。
全链路标准姿势：**校验 → 慢哈希放事务外 → 事务内做 IO → 抛错自动回滚**。`transaction { }` 闭包替你管好了
BEGIN/COMMIT/ROLLBACK，业务代码只管"成功 return、失败 throw"——这是比 Drogon 手写 `awaitCommit`、
Axum 手写 `finish` 更省心的一版。

## 14. 测试与契约验证

- `./test`：13 个纯函数用例——IsoDate 解析/往返/字符串序、Validation 规则、JWT 往返/过期/篡改、
  refresh token 形状、UUID hex 往返、推荐解析去重钳位。不碰数据库，秒级完成。
- 契约：`verify-contract.sh vapor`（黑盒 104 用例 × PG/SQLite 双驱动）。
- UI 冒烟不单独跑 vapor（SPA 通过 :9080 代理，对后端无感知；`hello switch vapor` 后任一前端可用）。

## 15. 常见改动应该改哪里

| 想改什么 | 改哪里 |
|---|---|
| 新增端点 | `Web/Routes.swift` 注册 + 对应 Service 加方法 |
| 改字段校验规则 | `Services/Validation.swift`（注意与 spec/openapi.yaml 同步） |
| 改响应字段 | `Services/MapperService.swift` |
| 改 SQL / 加索引利用 | `Infra/Repositories.swift` |
| 改跨库存储格式 | `Infra/Database.swift` 编解码助手 + `Infra/IsoDate.swift`（须双驱动复验） |
| 改鉴权/Token 策略 | `Services/SecurityService.swift` + `AuthService.swift` |
| 加共享可变状态 | 放进 actor（参照 `LoginRateLimiter`），别用裸全局变量 |
| 改 LLM 供应商/提示词 | `spec/llm/*.prompt.md`（模板优先）或 `LlmClient.swift` |

## 16. 学到这里之后

读到这里，你已经掌握了这个 Swift 后端最关键的部分：全链路 `async`/`await` 的同步式写法、
用 **actor 收纳共享可变状态**（`AsyncGate` / `LoginRateLimiter`）、值类型 struct 构造函数注入、
手工 `JSON` 枚举树保证契约的显式 null、`transaction { }` 闭包式事务 + outcome 枚举。

下一步建议：

- 跟着 §13 的注册链路，把 `login` / `refresh` / `addFavorite` 也读一遍，注意它们怎么用同一套
  `db.transaction { sql in ... }` + outcome 模式。
- 重点精读 §7 的 `AsyncGate`——它是"如何在不阻塞事件循环的前提下串行化单连接"的范例，
  是 Swift 并发模型最值得带走的一段。
- 把本实现和 `backends/ktor`（Kotlin 协程 + 连接池=1）、`backends/drogon`（C++ 协程 + 手写 awaitCommit）
  并排读——三种"协程语言"如何各自解决"SQLite 单写串行"与"事务提交时机"，是这个项目最有意思的对照。

之后可深入 Swift 并发进阶：Swift 6 严格并发模式（本项目刻意没开）、`TaskGroup` 并发查询、
`AsyncSequence`。本实现保持轻量，把这些留给后续。

## 17. 读代码的路线

1. `entrypoint.swift` → `Routes.swift`：先看清"有哪些门，门后调谁"。
2. **§5**（Swift 并发四件事）配合 `Json.swift` + `Envelope.swift` + `ApiError.swift`：理解响应外壳如何保证契约形状。
3. `Database.swift`：两个原语 + `AsyncGate` + 跨库编解码——这是全实现最核心的 60 行（§7）。
4. 挑一条完整链路走通：`AuthService.register`（§13）或 `POST /me/favorites` → UPSERT 判定 → 计数自增。
5. `AuthService.refresh`：outcome 枚举如何实现"先提交吊销再抛 401"。
6. 最后扫 `LlmClient.swift` 对照根 CLAUDE.md 的日志规范。
