# HelloTime Pro Ktor 后端技术手册与代码导读

本文面向已经熟悉 Kotlin 基本语法（data class、协程、扩展函数、lambda、nullable 类型），但还没系统接触过 Ktor、Exposed、HikariCP 或 JVM 后端分层的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Ktor 后端后，代码按什么顺序执行。
- Ktor、Netty、kotlinx.serialization、Exposed、HikariCP、java-jwt 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

## 1. 技术选型与设计特色

HelloTime Pro 的 Ktor 后端实现基于 **Kotlin + Ktor + Exposed** 核心骨架，使用 Netty 作为 HTTP 引擎，`kotlinx.serialization` 负责 JSON，HikariCP 管理数据库连接池，`java-jwt` 与 bcrypt 处理鉴权，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。数据库 schema 初始化、reset、seed 由仓库级 `scripts/db` 统一维护，Ktor 服务只连接已经准备好的数据库。

- **Ktor（插件式轻量 Web 框架）**：不像 Spring Boot 那样依赖大规模自动装配，Ktor 的功能通过 `install(ContentNegotiation)`、`install(StatusPages)`、`routing { ... }` 显式组合，适合展示“轻量 JVM 服务”的写法。
- **Kotlin（强类型 + 简洁表达）**：请求/响应 DTO 用 `@Serializable data class` 表达，nullable 类型能直接反映字段可选性，service 代码比 Java 更紧凑。
- **Exposed（类型安全 SQL DSL）**：仓库层用 Kotlin DSL 表达查询、排序、事务，不走 JPA 实体生命周期，也不让 ORM 隐式建表。
- **跨库列类型**：`CrossDbColumns.kt` 自定义 UUID/时间戳列类型，让同一套 Exposed 表定义在 PostgreSQL 和 SQLite 下读写不同存储格式。
- **手动依赖装配**：`AppComponents` 明确 new 出 repository/service，不引入 DI 容器。依赖关系一眼可读，适合教学项目。

## 2. 先建立整体地图

核心目录：

```text
backends/ktor/
├── build.gradle.kts                         # Gradle Kotlin DSL
├── run / build / test                       # 运行、构建、测试脚本
└── src/main/kotlin/com/hellotimepro/ktor/
    ├── Application.kt                       # main、插件安装、路由注册
    ├── AppComponents.kt                     # 手动依赖装配
    ├── config/AppConfig.kt                  # 环境变量配置
    ├── db/                                  # 数据库连接、表定义、跨库列类型
    ├── repository/                          # Exposed 查询封装
    ├── service/                             # 业务逻辑、校验、LLM 客户端
    ├── web/                                 # ApiException、AuthContext
    ├── domain/Models.kt                     # 领域模型
    └── dto/Dtos.kt                          # @Serializable 请求/响应 DTO
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Netty engine
  ▼
Ktor Application.module()
  │ ContentNegotiation / CORS / StatusPages
  ▼
routing { get/post/... }
  │ call.receive<T>() 反序列化
  │ AuthContext 解析 Bearer token
  ▼
service/*
  │ 业务规则、事务、DTO 组装
  ▼
repository/*
  │ Exposed DSL
  ▼
PostgreSQL 或 SQLite
```

返回方向上，service 返回 DTO，路由调用 `call.ok(...)` 包成统一成功响应；业务异常抛 `ApiException`，由 `StatusPages` 转成契约约定的错误外壳。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/ktor
DB_DRIVER=sqlite ./run       # SQLite，零外部数据库依赖
../../scripts/db reset --seed # 显式准备 PostgreSQL 数据库
./run                        # 默认 PostgreSQL
```

也可以通过仓库级 dev manager：

```bash
./scripts/db reset --seed
./scripts/hello start ktor
./scripts/hello logs ktor
```

常用验证：

```bash
./build
./test
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh ktor
../../verification/scripts/verify-contract.sh ktor
```

`run` 不创建 schema、不迁移、不 seed。PostgreSQL 连接通常由 `scripts/hello` 从 `data/.hello-state.json` 注入；直接运行时可显式传 `DB_URL`。

## 4. 入口：`Application.kt`

`main()` 做三件事：

```kotlin
val config = AppConfig()
Db.init(config)
val components = AppComponents(config)
embeddedServer(Netty, port = config.port, host = config.host) {
    module(components)
}.start(wait = true)
```

- `AppConfig()`：读取环境变量，得到端口、数据库、JWT、LLM 等配置。
- `Db.init(config)`：初始化 HikariCP/Exposed 连接，不做 DDL。
- `AppComponents(config)`：手动装配所有 repository/service。

`module()` 安装 Ktor 插件：

- `ContentNegotiation`：把 JSON body 反序列化为 `@Serializable` DTO。
- `CORS`：开发期允许前端访问。
- `StatusPages`：集中处理业务异常、坏 JSON、未知异常。
- `routing`：注册 `/api/v1/*` 路由和 `/static/*` 静态资源。

## 5. 路由层：显式、集中、薄

路由集中在 `registerRoutes(c: AppComponents)`，每个端点都保持很薄：

```kotlin
post("/api/v1/capsules") {
    val user = c.authContext.required(authHeader(call))
    call.ok(c.capsuleService.create(user, call.receive<CreateCapsuleRequest>()), HttpStatusCode.Created)
}
```

这段代码的顺序是：

1. 从 `Authorization` 头解析当前用户。
2. `call.receive<T>()` 反序列化请求体。
3. 调用 service 层执行业务。
4. `call.ok(...)` 包统一成功响应。

分页参数用 `intParam()` 手写解析。缺失时使用默认值，传了非整数则抛 `VALIDATION_ERROR`，避免 Ktor 默认 400 与 OpenAPI 契约不一致。

## 6. 依赖装配：`AppComponents`

Ktor 本身不强制 DI 容器。本项目用 `AppComponents` 做手动装配：

```kotlin
private val userRepository = UserRepository()
private val securityService = SecurityService(config)
val authService = AuthService(config, userRepository, refreshTokenRepository, securityService, ...)
val authContext = AuthContext(securityService, userRepository)
```

优点：

- 没有反射和自动扫描，启动路径清楚。
- 单例/无状态对象一眼可见。
- 教学读者能直接看出每个 service 依赖什么。

代价是对象数量继续增长时需要手动维护构造顺序；如果项目规模继续扩大，可以引入 Koin 或 Spring，但这个实现刻意保持轻量。

## 7. 数据库层：Exposed + HikariCP

`db/Database.kt` 负责把 `DB_DRIVER` / `DB_URL` 转成 JDBC + HikariCP 配置：

- PostgreSQL：使用 `jdbc:postgresql://...`，连接池可多连接。
- SQLite：使用本地文件，连接池大小固定为 1，并开启外键/WAL。

仓库层通过 Exposed 的 transaction/dbQuery 封装访问数据库。表结构在 `db/Tables.kt` 里表达，但这里只用于查询和映射，不调用 `SchemaUtils.create`，也不让应用建表。

### 跨库列类型

`CrossDbColumns.kt` 是这个实现最值得读的文件之一：

- PostgreSQL 下 UUID 用原生 `uuid`，时间用 `TIMESTAMP WITH TIME ZONE`。
- SQLite 下 UUID 存 32 位无横线 hex TEXT，时间存 ISO-8601 TEXT。
- 写出格式与 seed 对齐：`T` 分隔、UTC、`+00:00`，保证字符串比较的 `open_at <= now` 和 `ORDER BY created_at` 正确。

这相当于 Ktor/Exposed 版的“跨库类型适配层”，对应 Spring 的自定义 JDBC type、ASP.NET 的 EF Core value converter。

## 8. Repository 与 Service

Repository 层只做数据库读写：

- `UserRepository`
- `CapsuleRepository`
- `FavoriteRepository`
- `RefreshTokenRepository`

Service 层负责业务规则：

- `AuthService`：注册、登录、refresh token 轮转、改密吊销。
- `CapsuleService`：创建胶囊、按 code 查询、删除自己的胶囊。
- `PlazaService`：广场列表、搜索、排序、我的胶囊、我的收藏。
- `FavoriteService`：收藏/取消收藏与 `favorite_count` 一致性。
- `CapsuleSuggestionService` / `CapsuleRecommendationService`：AI 辅助接口。

`MapperService` 把 domain model 转成 DTO，避免路由层或 repository 层直接拼响应。

## 9. 事务与一致性

`favorite_count` 是冗余计数字段，必须和 `favorites` 表同事务更新。Ktor 实现的关键点：

- PostgreSQL 路径用 `SELECT ... FOR UPDATE` 锁胶囊行。
- SQLite 路径依赖单写事务和连接池大小 1。
- 重复收藏返回当前计数，不重复 +1。
- 重复取消返回 204，不重复 -1。

refresh token 轮转也需要事务意识：旧 token 被重放时，要先提交同 family 的吊销，再返回 401。代码里用 outcome 区分“要提交的失败”和“要回滚的异常”，对应 Spring 中 `noRollbackFor` 思路。

## 10. 鉴权与安全

`SecurityService` 负责底层安全原语：

- BCrypt 哈希与校验密码。
- JWT access token 签发和校验。
- refresh token 随机生成与哈希存储。

`AuthContext` 是 Web 边界：解析 `Authorization: Bearer ...`，再从数据库加载用户。它提供：

- `required(...)`：未登录或 token 无效直接抛 `UNAUTHORIZED`。
- `optional(...)`：匿名访问广场/胶囊详情时返回 null。

业务 service 不直接读 HTTP header，这样 presentation 与 application 层保持分离。

## 11. 校验与错误处理

Ktor 没有像 Bean Validation 那样的内建注解校验。本项目把校验集中在 `service/Validation.kt`：

- 邮箱、昵称、密码强度、头像 id、胶囊标题/正文长度。
- `openAt` 必须晚于当前时间 60 秒，且不超过 10 年。
- 更新资料至少提供一个字段。
- AI 推荐 count 必须在 3 到 8 之间。

错误统一抛 `ApiException`。`StatusPages` 会把它转为：

```json
{
  "success": false,
  "data": null,
  "message": "...",
  "errorCode": "VALIDATION_ERROR",
  "details": [...]
}
```

坏 JSON 或缺必填字段由 Ktor 抛 `BadRequestException`，这里也统一映射成 422。

## 12. LLM 客户端

`service/LlmClient.kt` 对齐 FastAPI 参考实现的 LLM 行为：

- 未启用或未配置 API key 时，建议接口走本地兜底，推荐接口返回空列表。
- 请求前打 `LLM request  model=... url=...`。
- 成功打 `LLM response model=... elapsed_ms=... tokens=...`。
- 失败打 `LLM error    model=... elapsed_ms=... status=...` 或 `error=...`。
- 支持 Responses API，也兼容部分 chat-completions 风格网关。

提示词来自 `spec/llm/*.prompt.md`，代码里只负责填变量、解析 JSON、做范围裁剪。

## 13. 测试与契约验证

本后端有轻量 `SmokeTest`，重点仍是仓库级黑盒契约：

```bash
./test
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh ktor
../../verification/scripts/verify-contract.sh ktor
```

黑盒契约不读取实现细节，只从 HTTP 行为验证状态码、响应壳、错误码、鉴权、胶囊开放规则、收藏计数、AI 辅助接口等。

## 14. 常见改动应该改哪里

新增接口：

1. 先改 `spec/api/openapi.yaml`。
2. 在 `dto/Dtos.kt` 增加请求/响应 DTO。
3. 在 `service/` 增加业务函数。
4. 如需数据库访问，在 `repository/` 增加查询。
5. 在 `Application.kt` 的 `registerRoutes` 注册路由。
6. 补黑盒契约或相应验证。

新增字段：

1. 先改 `spec/api` / `spec/db`。
2. 更新仓库级数据库维护脚本。
3. 更新 `db/Tables.kt` 和 `domain/Models.kt`。
4. 更新 repository row mapper。
5. 更新 DTO 和 `MapperService`。
6. 同时跑 PostgreSQL 与 SQLite 契约验证。

修改跨库时间/UUID行为：

1. 先读 `CrossDbColumns.kt`。
2. 确认 seed 数据格式、SQLite 字符串排序和 Postgres 原生类型三者一致。
3. 补 `src/test` 中的纯逻辑测试，再跑契约验证。

## 15. 读代码的路线

第一次读 Ktor 后端，建议按这个顺序：

1. `Application.kt`：看插件安装、路由表、统一响应。
2. `AppComponents.kt`：看依赖关系。
3. `dto/Dtos.kt`：看 API 数据形状。
4. `service/Validation.kt` 和 `web/ApiException.kt`：看校验与错误模型。
5. `service/AuthService.kt`、`CapsuleService.kt`、`FavoriteService.kt`：看核心业务。
6. `repository/*`：看 Exposed 查询。
7. `db/CrossDbColumns.kt`：最后看跨库类型适配。

这样读会先建立 HTTP 行为，再进入数据库细节，比较符合这个实现的教学重点。
