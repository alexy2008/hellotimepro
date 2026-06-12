# HelloTime Pro Vapor 后端技术手册与代码导读

> 面向：想通过本实现学习 Swift 服务端开发，或要对照其它栈理解 HelloTime Pro 契约的读者。
> 建议先读 `spec/api/openapi.yaml` 与根 `CLAUDE.md`，再回来按"读代码的路线"走一遍。

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

## 2. 先建立整体地图

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
        Validation.swift        手写字段校验（对齐 openapi 正则/长度）
        SecurityService.swift   bcrypt / JWT / refresh token
        AuthService.swift       注册/登录/刷新/登出/改密 + 登录限流 actor
        UserService.swift       资料查改
        CapsuleService.swift    创建/按码查/广场详情/删除
        PlazaService.swift      广场/我创建的/我收藏的 分页
        FavoriteService.swift   收藏/取消（计数一致性）
        AvatarService.swift     spec/avatars/catalog.json
        LlmClient.swift         LLM HTTP 客户端（日志规范/重试）
        SuggestionService.swift 胶囊建议（本地兜底）
        RecommendationService.swift 主题推荐（无兜底）
        MapperService.swift     领域模型 → 响应 JSON
      Infra/
        Database.swift        ← AppDatabase：连接、事务、跨库编解码、AsyncGate
        Repositories.swift    ← 四个仓储（users/capsules/favorites/refresh_tokens）
        IsoDate.swift         ← ISO-8601 解析/格式化（SQLite TEXT 约定）
      Domain/Models.swift     ← User / Capsule / CapsuleView / RefreshTokenRow
    Tests/AppTests/           ← 纯函数单元测试（无需数据库）
```

**目录为什么叫 server**：SwiftPM 的**根包身份取自所在目录名**。如果包直接放在
`backends/vapor/`，根包身份 `vapor` 会与依赖包 `vapor`（来自 vapor/vapor.git）同名，
SwiftPM 报 `cyclic dependency between packages`。挪进 `server/` 子目录即可（身份变成 `server`）。
这是 Vapor 项目放在叫 "vapor" 的目录里都会踩的坑。

## 3. 如何运行和验证

```bash
./scripts/db reset --seed                  # schema + 演示数据（后端自身不建表）
./scripts/hello start vapor                # 注入 DB_DRIVER/DB_URL/LLM_*
curl -s localhost:29060/api/v1/health | python3 -m json.tool

# 契约验证（黑盒 104 用例）
./verification/scripts/verify-contract.sh vapor                   # PostgreSQL
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh vapor  # SQLite

# 单元测试（13 个纯函数用例：IsoDate/Validation/JWT/UUID/推荐解析）
cd backends/vapor && ./test
```

冷启动注意：`run` 里有增量 `swift build -c release`。第一次必须先 `./build` 预热
（冷 release 编译数分钟），否则契约脚本 60s 就绪窗口会超时。

## 4. 入口与配置：`entrypoint.swift` + `Config/AppConfig.swift`

`@main` 流程：`Environment.detect()`（解析 `serve --env production`）→
`LoggingSystem.bootstrap` → `Application.make` → `configure` → `execute`。

`configure` 做四件事：
1. 设 hostname/port（`PORT` 默认 29060——hello CLI 不注入 PORT，默认值必须就是登记端口）；
2. 设 `app.http.client` 超时（供 LLM 客户端用）；
3. **重置中间件栈**：`app.middleware = .init()` 丢掉 Vapor 默认 ErrorMiddleware
   （它的错误 JSON 不是契约外壳），换成 CORS + 自研 `ApiErrorMiddleware`；
4. 建 `AppDatabase` → `AppComponents` → 注册路由；`lifecycle.use` 挂连接回收。

`AppConfig` 全部来自环境变量（带默认值），与 Ktor 版字段一一对应。

## 5. 路由层：显式、集中、薄

`Web/Routes.swift` 一个函数注册全部端点。处理器只做三件事：取参（`intParam`
把"存在但非整数"的分页参数转 422）、调 service、`Envelope.ok(...)` 包壳。
鉴权不是中间件而是显式调用：受保护端点第一行 `authContext.required(req)`，
匿名可带态端点用 `optional(req)`——和 Ktor 版完全同构，便于跨栈对照。

静态资源（头像/图标 SVG）从仓库 `spec/` 目录直接 serve，带文件名防穿越白名单。

## 6. 依赖装配：`AppComponents`

没有 DI 容器，构造函数注入：仓储 → 服务，全部值类型 struct（除有状态的
`LoginRateLimiter` actor 与 `AppDatabase`）。和 Spring 的 `@Service` 网络、
Ktor 的 `AppComponents` 是同一张依赖图。

## 7. 数据库层：AppDatabase 两个原语

```swift
db.withSQL { sql in ... }       // 一个连接上执行（无显式事务）
db.transaction { sql in ... }   // BEGIN/COMMIT，异常 ROLLBACK
```

- **PostgreSQL**：`EventLoopGroupConnectionPool<PostgresConnectionSource>`，
  事务用 raw `BEGIN`/`COMMIT` 包裹同一连接（SQLKit 本身不提供跨驱动事务 API）。
- **SQLite**：**单连接 + `AsyncGate`**（actor 实现的 FIFO 异步互斥）串行化全部访问，
  等价 Ktor 的"连接池大小为 1"；事务用 `BEGIN IMMEDIATE` 直接拿写锁。
- 约定：service 公共方法只调一次 withSQL/transaction（门闩不可重入，嵌套会死锁）。

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
读取侧 `IsoDate.parse` 容忍空格分隔/可变小数位/缺省偏移。这是 Spring `CrossDb*JdbcType`、
Ktor `CrossDbColumns` 的 Swift 等价物。

## 8. Repository 与 Service

仓储是持有 `dbx: AppDatabase`（编解码助手）的 struct，方法第一个参数都是当前连接的
`SQLDatabase`。SQL 用 SQLKit 的 `SQLQueryString` 插值（`\(bind:)` 生成参数占位符），
动态片段（filter/q/排序）用 `appendLiteral`/`appendInterpolation` 增量拼接。

列表查询直接 JOIN `users` 取创建者摘要（`CapsuleView`），登录用户的 `favoritedByMe`
用 `LEFT JOIN favorites ... (fv.user_id IS NOT NULL) AS favorited_by_me` 一趟查完，
不做 N+1。

## 9. 事务与一致性

- **收藏计数**（`FavoriteService`）：`favorite_count` 是冗余计数器，与 favorites 行变更
  同事务。幂等性与并发正确性靠 **UPSERT 判定**——
  `INSERT ... ON CONFLICT DO NOTHING RETURNING created_at` 返回行 ⇒ 真插入 ⇒ 原子
  `favorite_count = favorite_count + 1`；没返回 ⇒ 已收藏 ⇒ 只回读原 `favoritedAt`。
  并发 5 连击下不重复计数（契约有专门用例）。PG/SQLite（≥3.35）此语法完全一致。
- **取消收藏**：`DELETE ... RETURNING` 判定是否真删，真删才 `-1`（带 `favorite_count > 0` 护栏）。
- **refresh 轮转**（`AuthService.refresh`）：重用检测命中时**必须先提交家族吊销再抛 401**。
  事务闭包内不抛错，返回 `RefreshOutcome` 枚举，`throw` 放在事务外——等价 Spring 的
  `noRollbackFor=ApiException`。PG 路径对 token 行加 `FOR UPDATE` 防双花。

## 10. 鉴权与安全

- **bcrypt**：Vapor 内置 `Bcrypt`（cost 10），兼容 seed 的 `$2b$` 哈希。
- **JWT HS256**（`SecurityService`）：手写 base64url(header).base64url(payload).HMAC。
  校验顺序：形状 → 签名（`HMAC.isValidAuthenticationCode`，常数时间）→ exp。
  过期返回 `access_token_expired`、其它非法 `invalid_token`（契约对 401 message 有约定）。
- **refresh token**：32 字节随机 → base64url；库里只存 SHA-256 hex（`refresh_tokens.token_hash`）。
- **登录限流**：`LoginRateLimiter` actor，每邮箱 60s 滑动窗口记失败次数，达到阈值（默认 10）
  抛 429。进程内存实现，重启即清零（教学项目可接受）。

## 11. 校验与错误处理

三层防线，全部汇入 `ApiErrorMiddleware`：

1. **请求体解码**：DTO 字段全可选（缺字段不在解码层炸），坏 JSON/类型不符抛 `DecodingError`
   → 422 + `details:[{field:"body"}]`；
2. **手写校验**（`Validation`）：正则/长度对齐 openapi（密码前瞻断言、昵称 `\p{L}\p{N}_-`、
   code 8 位等），抛 `ApiError.validation(message, field)` → 422 + 逐字段 details；
3. **业务异常**：`ApiError` 静态工厂对应八个 errorCode（401/403/404/409/400/429/422/500），
   中间件转成统一外壳；漏网之鱼 → 500 INTERNAL_ERROR（带日志）。

成功外壳由 `Envelope.ok` 构造，`message`/`errorCode` 显式 `null`（见 §1 JSON 树动机）。

## 12. LLM 客户端

`Services/LlmClient.swift`，基于 `app.client`（AsyncHTTPClient）。要点：

- **日志规范**（根 CLAUDE.md）：请求前 `LLM request model= url=`（INFO）、成功
  `LLM response model= elapsed_ms= tokens=`（INFO）、失败 `LLM error ... status=/error=`（WARNING）。
- **重试策略**：仅网络/TLS 瞬时错误重试（默认 2 次、退避 400ms×n）；HTTP 4xx/5xx 与坏 JSON 不重试。
- **API 风格**：默认 `chat`（兼容网关大多只支持它）；`responses`/`auto` 可切。
  chat 路径带 `thinking: disabled`，网关报 400 时去掉重试一次。
- **UA 伪装**：默认 Chrome UA，避开 Cloudflare 1010。
- 建议端点失败走 `local-template` 兜底（7 篇内置中文胶囊）；推荐端点失败返回空列表
  `generatedBy=none`（契约规定不做兜底）。

契约测试默认 `LLM_ENABLED=false`，客户端入口直接抛错、上层立即兜底，HTTP 路径不在测试链上。

## 13. 测试与契约验证

- `./test`：13 个纯函数用例——IsoDate 解析/往返/字符串序、Validation 规则、JWT 往返/过期/篡改、
  refresh token 形状、UUID hex 往返、推荐解析去重钳位。不碰数据库，秒级完成。
- 契约：`verify-contract.sh vapor`（黑盒 104 用例 × PG/SQLite 双驱动）。
- UI 冒烟不单独跑 vapor（SPA 通过 :9080 代理，对后端无感知；`hello switch vapor` 后任一前端可用）。

## 14. 常见改动应该改哪里

| 想改什么 | 改哪里 |
|---|---|
| 新增端点 | `Web/Routes.swift` 注册 + 对应 Service 加方法 |
| 改字段校验规则 | `Services/Validation.swift`（注意与 spec/openapi.yaml 同步） |
| 改响应字段 | `Services/MapperService.swift` |
| 改 SQL / 加索引利用 | `Infra/Repositories.swift` |
| 改跨库存储格式 | `Infra/Database.swift` 编解码助手 + `Infra/IsoDate.swift`（须双驱动复验） |
| 改鉴权/Token 策略 | `Services/SecurityService.swift` + `AuthService.swift` |
| 改 LLM 供应商/提示词 | `spec/llm/*.prompt.md`（模板优先）或 `LlmClient.swift` |
| 改启动/端口/环境变量 | `Config/AppConfig.swift` + `run` 脚本 |

## 15. 读代码的路线

1. `entrypoint.swift` → `Routes.swift`：先看清"有哪些门，门后调谁"。
2. `Json.swift` + `Envelope.swift` + `ApiError.swift`：理解响应外壳如何保证契约形状。
3. `Database.swift`：两个原语 + 跨库编解码——这是全实现最核心的 60 行。
4. 挑一条完整链路走通：`POST /me/favorites` → `FavoriteService.addFavorite` →
   UPSERT 判定 → 计数自增（对照 §9 读）。
5. `AuthService.refresh`：outcome 枚举如何实现"先提交吊销再抛 401"。
6. 最后扫 `LlmClient.swift` 对照根 CLAUDE.md 的日志规范。
