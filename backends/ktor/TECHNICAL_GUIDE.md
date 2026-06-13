# HelloTime Pro Ktor 后端技术手册与代码导读

本文面向已经熟悉 Kotlin 基本语法（data class、协程、扩展函数、lambda、nullable 类型），但还没系统接触过 Ktor、Exposed、HikariCP 或 JVM 后端分层的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Ktor 后端后，代码按什么顺序执行。
- Ktor、Netty、kotlinx.serialization、Exposed、HikariCP、java-jwt 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：§1～§4 建立选型、地图、入口认识；**§5 是钥匙**——讲清 Ktor/Exposed 的几个核心机制
> （插件 `install`、挂起事务、Exposed DSL、手动装配）；§6～§11 按请求生命周期分层；其中 **§7 的跨库列类型**
> 是这个实现最值得读的基础设施；§13 用一次注册请求把全链路串起来。

## 1. 技术选型与设计特色

HelloTime Pro 的 Ktor 后端实现基于 **Kotlin + Ktor + Exposed** 核心骨架，使用 Netty 作为 HTTP 引擎，`kotlinx.serialization` 负责 JSON，HikariCP 管理数据库连接池，`java-jwt` 与 bcrypt 处理鉴权，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。数据库 schema 初始化、reset、seed 由仓库级 `scripts/db` 统一维护，Ktor 服务只连接已经准备好的数据库。端口 **29090**（见根 `CLAUDE.md` 端口分配）。

- **Ktor（插件式轻量 Web 框架）**：不像 Spring Boot 那样依赖大规模自动装配，Ktor 的功能通过 `install(ContentNegotiation)`、`install(StatusPages)`、`routing { ... }` 显式组合，适合展示"轻量 JVM 服务"的写法。
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

```bash
cd backends/ktor
DB_DRIVER=sqlite ./run        # SQLite，零外部数据库依赖
../../scripts/db reset --seed # 显式准备 PostgreSQL 数据库
./run                         # 默认 PostgreSQL
./build
./test
../../verification/scripts/verify-contract.sh ktor          # 契约 104 用例（PG）
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh ktor
```

`run` 不创建 schema、不迁移、不 seed。PostgreSQL 连接通常由 `scripts/hello` 从 `data/.hello-state.json` 注入；直接运行时可显式传 `DB_URL`。

## 4. 入口：`Application.kt`

`main()` 做三件事：

```kotlin
val config = AppConfig()
Db.init(config)                       // 初始化 HikariCP/Exposed 连接，不做 DDL
val components = AppComponents(config) // 手动装配所有 repository/service
embeddedServer(Netty, port = config.port, host = config.host) {
    module(components)
}.start(wait = true)
```

`module()` 安装 Ktor 插件并注册路由：

- `ContentNegotiation`：把 JSON body 反序列化为 `@Serializable` DTO。关键配置 **`explicitNulls = true`**——
  让 `message`/`errorCode`/`content` 等 null 字段**显式输出** `null`（契约用 strict equal 断言这些键存在）。
- `CORS`：开发期允许前端访问。
- `StatusPages`：集中处理业务异常、坏 JSON、未知异常（见 §11）。
- `routing`：注册 `/api/v1/*` 路由和 `/static/*` 静态资源。

## 5. Ktor / Exposed 的几个关键思想

看懂下面四件事，全篇剩下的都是常规 Kotlin。

### 5.1 插件 `install` 显式组合

Ktor 没有"自动配置"——每个能力都靠 `install(...)` 显式装上，启动路径一眼可见。这与 Spring Boot 的
"约定大于配置 + 自动装配"是两种哲学：Ktor 把组合权交给你，代价是要自己写、回报是没有隐藏行为。

```kotlin
install(ContentNegotiation) { json(Json { explicitNulls = true; ignoreUnknownKeys = true }) }
install(CORS) { anyHost(); ... }
install(StatusPages) { exception<ApiException> { call, cause -> ... } ... }
```

### 5.2 路由薄、`call.ok` 包壳、`intParam` 卡分页

路由集中在 `registerRoutes(c: AppComponents)`，每个端点都保持很薄——取参 → 调 service → 包壳：

```kotlin
post("/api/v1/capsules") {
    val user = c.authContext.required(authHeader(call))             // 鉴权（缺失/过期 → 401）
    call.ok(c.capsuleService.create(user, call.receive<CreateCapsuleRequest>()), HttpStatusCode.Created)
}
```

`call.ok(data, status)` 是统一成功外壳的扩展函数；鉴权不是中间件而是显式第一行 `required(...)`/`optional(...)`。
分页参数用手写 `intParam()`：缺失用默认值、**传了非整数则抛 `VALIDATION_ERROR`**，避免 Ktor 默认 400 与契约不一致。

### 5.3 挂起事务：`newSuspendedTransaction`

Exposed 的事务在协程里用 `newSuspendedTransaction(Dispatchers.IO)` 开启。本项目封装成一个 `dbQuery {}`：

```kotlin
suspend fun <T> dbQuery(block: () -> T): T =
    newSuspendedTransaction(Dispatchers.IO, Db.database) { block() }
```

**纪律**：每个 service 公共方法只调用一次 `dbQuery {}`，保证多步操作在同一事务里原子提交。block 正常返回即 COMMIT，
抛异常即 ROLLBACK。

### 5.4 Exposed DSL：类型安全的 SQL

仓库层不写 SQL 字符串，而是用 Exposed 的 Kotlin DSL，列名是强类型对象（`Capsules.id`、`Capsules.favoriteCount`）：

```kotlin
fun findByIdForUpdate(id: UUID): Capsule? {
    val q = Capsules.select { Capsules.id eq id }
    if (!isSqliteDialect) q.forUpdate()       // Postgres 行锁；SQLite 单写事务天然串行
    return q.firstOrNull()?.toCapsule()
}
fun incrementFavoriteCount(id: UUID) =
    Capsules.update({ Capsules.id eq id }) {
        with(SqlExpressionBuilder) { it[favoriteCount] = favoriteCount + 1 }  // 原子表达式，非读-改-写
    }
```

DSL 的好处是列名拼错、类型不符在**编译期**就报错。复杂条件（广场过滤/搜索）用 `Op<Boolean>` 组合，
搜索甚至用 `exists(Users.select { ... })` 子查询，全程类型安全。

### 5.5 手动依赖装配：`AppComponents`

Ktor 不强制 DI 容器。`AppComponents` 明确 new 出对象，构造顺序与依赖关系在源码里一眼可读：

```kotlin
private val userRepository = UserRepository()
private val securityService = SecurityService(config)
val authService = AuthService(config, userRepository, refreshTokenRepository, securityService, ...)
val authContext = AuthContext(securityService, userRepository)
```

优点：没有反射和自动扫描、启动路径清楚、单例/无状态对象一眼可见。代价是对象多时要手动维护构造顺序；
规模再大可引入 Koin/Spring，但这个实现刻意保持轻量。

## 6. 依赖装配与配置

`AppConfig()` 读环境变量得到端口、数据库、JWT、LLM 等配置（带默认值，默认端口即登记端口 29090）。
`AppComponents(config)` 见 §5.5。

## 7. 数据库层：Exposed + HikariCP

`db/Database.kt` 把 `DB_DRIVER` / `DB_URL` 转成 JDBC + HikariCP 配置：

- PostgreSQL：`jdbc:postgresql://...`，连接池可多连接。
- SQLite：本地文件，**连接池大小固定为 1**（`maximumPoolSize = 1`），避免 "database is locked"——
  等价于 Vapor 的 AsyncGate、Axum 的池上限 1。

表结构在 `db/Tables.kt` 表达，只用于查询和映射，**不调用 `SchemaUtils.create`**（schema 由 `scripts/db` 准备）。

### 跨库列类型（最值得读）

`CrossDbColumns.kt` 自定义两个 `ColumnType`，在同一套表定义上按方言分流读写格式：

```kotlin
class CrossTimestampColumnType : ColumnType() {
    override fun sqlType() = if (isSqliteDialect) "TEXT" else "TIMESTAMP WITH TIME ZONE"
    override fun notNullValueToDB(value: Any): Any {
        val odt = (value as OffsetDateTime).withOffsetSameInstant(ZoneOffset.UTC)
        return if (isSqliteDialect) odt.format(WRITE) else odt   // SQLite 写 ISO TEXT，PG 直传
    }
    companion object {
        // 与 seed 对齐：输出秒 + 可选小数秒，零偏移渲染成 +00:00（而非 ISO 默认的 Z）
        private val WRITE = DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
            .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd()
            .appendOffset("+HH:MM", "+00:00").toFormatter()
    }
}
```

- PostgreSQL 下 UUID 用原生 `uuid`、时间用 `timestamptz`。
- SQLite 下 UUID 存 32 位无横线 hex TEXT、时间存 ISO-8601 TEXT，写出格式与 seed 对齐（`T` 分隔、`+00:00`），
  保证字符串比较的 `open_at <= now` 和 `ORDER BY created_at` 正确；读取侧 `fromIso` 容忍空格分隔/缺省偏移。

这相当于 Ktor/Exposed 版的"跨库类型适配层"，对应 Spring 的自定义 JDBC type、ASP.NET 的 EF Core value converter。

## 8. Repository 与 Service

Repository 层只做数据库读写（`UserRepository` / `CapsuleRepository` / `FavoriteRepository` / `RefreshTokenRepository`），
全是 Exposed DSL（§5.4）。Service 层负责业务规则（`AuthService` / `CapsuleService` / `PlazaService` / `FavoriteService` +
两个 AI service）。`MapperService` 把 domain model 转成 DTO，避免路由层或 repository 层直接拼响应。

## 9. 事务与一致性

`favorite_count` 是冗余计数字段，必须和 `favorites` 表同事务更新（`FavoriteService`）：

```kotlin
suspend fun addFavorite(user: User, capsuleIdRaw: String?): FavoriteResult = dbQuery {
    val capsule = capsules.findByIdForUpdate(capsuleId) ?: throw ApiException.notFound("胶囊不存在")  // PG 行锁
    if (!capsule.inPlaza) throw ApiException.notFound("胶囊不存在")
    if (capsule.ownerId == user.id) throw ApiException.badRequest("不能收藏自己创建的胶囊")
    val existing = favorites.find(user.id, capsule.id)
    if (existing != null) return@dbQuery FavoriteResult(...)        // 幂等：已收藏返回原状态
    favorites.insert(Favorite(user.id, capsule.id, now))
    capsules.incrementFavoriteCount(capsule.id)                    // 原子 +1（§5.4）
    FavoriteResult(capsule.id.toString(), capsules.findById(capsule.id)?.favoriteCount ?: ..., isoInstant(now))
}
```

- PostgreSQL 路径用 `SELECT ... FOR UPDATE` 锁胶囊行；SQLite 依赖单写事务和连接池大小 1。
- 重复收藏返回当前计数不重复 +1；重复取消返回 204 不重复 -1（`decrementFavoriteCount` 带 `favoriteCount > 0` 护栏）。

refresh token 轮转用 outcome 模式（`RefreshOutcome` sealed interface）：事务内不抛业务错，旧 token 被重放时
**先提交同 family 的吊销、再返回 401**——`dbQuery` 提交后，外层 `when (outcome)` 才把 Reused/Invalid 转成 401。
代码里用 outcome 区分"要提交的失败"和"要回滚的异常"，对应 Spring 中 `noRollbackFor` 思路。

## 10. 鉴权与安全

`SecurityService` 用 **java-jwt（auth0）** 与 **favre bcrypt**：

```kotlin
private val algorithm = Algorithm.HMAC256(config.jwtSecret)
private val verifier = JWT.require(algorithm).build()

fun createAccessToken(user: User): String = JWT.create()
    .withSubject(user.id.toString()).withClaim("nickname", user.nickname)
    .withIssuedAt(...).withExpiresAt(...).sign(algorithm)

fun decodeAccessToken(token: String): DecodeResult = try {
    DecodeResult(verifier.verify(token).subject, null)
} catch (_: TokenExpiredException)   { DecodeResult(null, "access_token_expired") }
  catch (_: JWTVerificationException) { DecodeResult(null, "invalid_token") }   // 契约区分这两个 message
```

refresh token 用 `SecureRandom` 取 32 字节 → base64url，落库只存 SHA-256 hex。
`AuthContext` 是 Web 边界：`required(...)` 失败抛 `UNAUTHORIZED`、`optional(...)` 匿名返回 null——
业务 service 不直接读 HTTP header，presentation 与 application 层保持分离。

## 11. 校验与错误处理

Ktor 没有 Bean Validation 那样的内建注解校验，本项目把校验集中在 `service/Validation.kt`
（邮箱/昵称/密码强度/头像 id、`openAt` 晚于当前 60 秒且不超 10 年、更新资料至少一个字段、推荐 count 在 3-8）。

错误统一抛 `ApiException`（携带 `ErrorCode` 枚举 + HTTP status + details），`StatusPages` 转成契约外壳：

```kotlin
install(StatusPages) {
    exception<ApiException> { call, cause ->
        call.respond(cause.status, ErrorEnvelope(cause.message, cause.code.name, cause.details))
    }
    exception<BadRequestException> { call, _ ->   // 坏 JSON / 缺必填字段 → 422 VALIDATION_ERROR
        call.respond(UnprocessableEntity, ErrorEnvelope("字段校验失败", VALIDATION_ERROR, listOf(ErrorDetail("body", ...))))
    }
    exception<Throwable> { call, cause -> log.error(...); call.respond(InternalServerError, ...) }  // 兜底 500
}
```

## 12. LLM 客户端

`service/LlmClient.kt` 对齐 FastAPI 参考实现：日志规范（`LLM request/response/error` 三时机 + 必含字段）、
未启用/未配置 key 时建议接口本地兜底、推荐接口返回空列表、支持 Responses API 也兼容部分 chat 风格网关、
chat 关闭 `thinking`。提示词来自 `spec/llm/*.prompt.md`，代码只负责填变量、解析 JSON、做范围裁剪。

## 13. 从真实请求读代码：`POST /api/v1/auth/register`

把前面各层串起来，跟一次注册走到底（`AuthService.register`）：

```kotlin
suspend fun register(req: RegisterRequest): AuthTokens {
    // ① 校验（Validation）：缺字段/格式错抛 ApiException → StatusPages 转 422
    val email = Validation.email(req.email).lowercase()
    val rawPassword = Validation.password(req.password)
    val nickname = Validation.nickname(req.nickname)
    val avatarId = Validation.avatarFormat(req.avatarId)
    if (!avatars.exists(avatarId)) throw ApiException.validation("头像 ID 不存在", "avatarId")

    return dbQuery {                                              // ② 一次挂起事务（§5.3）
        if (users.existsByEmail(email)) throw ApiException.conflict("邮箱已被注册", "email")    // ③ 唯一性预检
        if (users.existsByNickname(nickname)) throw ApiException.conflict("昵称已被使用", "nickname")
        val user = User(id = UUID.randomUUID(), passwordHash = security.hashPassword(rawPassword), ...)  // ④ bcrypt
        users.insert(user)                                       // ⑤ Exposed insert
        issueTokenPair(user, null)                               // ⑥ 签发并落库 refresh token
    }   // ⑦ block 正常返回 → COMMIT；抛 ApiException → ROLLBACK
}
```

请求回到 `Application.kt` 的路由：`call.ok(tokens, HttpStatusCode.Created)` 包成 201。
全链路标准姿势：**校验（抛 ApiException）→ `dbQuery {}` 一个事务里做 IO → 正常 return 提交、抛错回滚**——
事务边界由 `dbQuery {}` 一行划定，比手写 BEGIN/COMMIT 干净。

> 注意 ④：bcrypt 在 `dbQuery` 闭包内调用。它是 CPU 密集操作（cost 10 约几十毫秒），握着连接做哈希会拖长持锁时间——
> 这是与 Axum/Vapor/Drogon"bcrypt 放事务外"略不同的取舍；教学项目下可接受，生产可前移到事务外。

## 14. 测试与契约验证

本后端有轻量 `SmokeTest`，重点仍是仓库级黑盒契约（104 用例 × 双驱动）。黑盒契约不读取实现细节，只从 HTTP 行为
验证状态码、响应壳、错误码、鉴权、胶囊开放规则、收藏计数、AI 辅助接口等。

```bash
./test
../../verification/scripts/verify-contract.sh ktor
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh ktor
```

## 15. 常见改动应该改哪里

| 想做什么 | 改哪里 |
|---|---|
| 新增接口 | `dto/Dtos.kt` 加 DTO → `service/` 加业务 → `repository/` 加查询 → `Application.kt` 的 `registerRoutes` 注册 |
| 新增字段校验 | `service/Validation.kt`（对照 spec/openapi.yaml） |
| 新增表/字段 | 先改 `spec/db` + 维护脚本 → `db/Tables.kt` + `domain/Models.kt` → repository row mapper → DTO + MapperService |
| 改响应结构 | `service/MapperService.kt` |
| 改跨库时间/UUID 行为 | `db/CrossDbColumns.kt`（确认 seed 格式、SQLite 字符串排序、Postgres 原生类型三者一致，须双驱动复验） |
| 加跨切关注 | 写 Ktor 插件 / 在 `module()` 里 `install(...)` |

## 16. 学到这里之后

读到这里，你已经掌握了这个 Kotlin 后端最关键的部分：插件 `install` 显式组合、`call.ok`/`call.receive` 路由、
**挂起事务 `dbQuery {}`**、Exposed DSL 类型安全查询、`CrossDbColumns` 跨库列类型、手动装配 `AppComponents`、
java-jwt + outcome 模式的 refresh 轮转。

下一步建议：

- 跟着 §13 的注册链路，把 `login` / `refresh`（`RefreshOutcome` sealed interface）/ `addFavorite`（行锁 + 原子自增）也读一遍。
- 重点精读 §7 的 `CrossDbColumns.kt`——它是"同一套 Exposed 表定义如何在两个库读写不同格式"的范例。
- 把本实现的 `CrossDbColumns` 和 `backends/spring-boot` 的 `@JdbcType`、`backends/aspnet` 的 `ValueConverter`
  并排读——三个 JVM/.NET 栈各自如何分流跨库存储格式；再对比 `backends/vapor`（连接池=1 ↔ AsyncGate）的并发处理。

之后可深入 Ktor/Exposed 进阶：自定义插件（Plugin API）、Exposed 的 DAO 模式（本项目用 DSL 而非 DAO）、
Koin 依赖注入。本实现刻意保持轻量，把这些留给后续。

## 17. 读代码的路线

1. `Application.kt`：看插件安装、路由表、统一响应（配合 §4/§5）。
2. `AppComponents.kt`：看依赖关系。
3. `dto/Dtos.kt`：看 API 数据形状。
4. `service/Validation.kt` 和 `web/ApiException.kt`：看校验与错误模型。
5. `service/AuthService.kt`（§13）、`CapsuleService.kt`、`FavoriteService.kt`：看核心业务。
6. `repository/*`：看 Exposed 查询。
7. `db/CrossDbColumns.kt`：最后看跨库类型适配（§7）。
