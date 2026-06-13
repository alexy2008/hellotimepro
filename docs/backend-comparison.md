# HelloTime Pro · 十个后端实现全面对比

> 对比对象：`backends/` 下已完成并通过契约验证的 **10 个**后端 ——
> **FastAPI**（参考实现）、**Spring Boot**、**Gin**、**NestJS**、**Elysia**、**Ktor**、**ASP.NET Core**、**Vapor**、**Axum**、**Drogon**。
> 数据采集日期：2026-06-13（逐行通读各家源码后重写，覆盖全部 10 家；前一版仅含先行 5 家）。代码量为物理行（`wc -l`，含注释空行），统计口径见 §3。
> 姊妹篇：前端对比见 [`frontend-comparison.md`](frontend-comparison.md)，全栈对比见 [`fullstack-comparison.md`](fullstack-comparison.md)；
> 打分评审见 [`backend-review.md`](backend-review.md)；单栈深读见各后端目录下的 `TECHNICAL_GUIDE.md`。

---

## 1. 为什么这十个能放在一起比

它们实现的是**同一个产品**，且共享 `spec/` 这一份单一事实来源：

- 同一份 API 契约（`spec/api/openapi.yaml`，18 个端点）；
- 同一套数据库 schema 语义（`spec/db/schema.sql`）；
- 同一组 **104 个黑盒契约用例**（`verification/`），从外部验证，不关心内部实现；
- 同一个双库约束：每个后端都要同时跑通 **PostgreSQL 和 SQLite**；
- schema 的初始化/重建/seed 一律由仓库级 `scripts/db` 维护，**后端自身不建表、不迁移、不 seed**（10 家统一）。

这意味着十者之间的所有差异都是**纯粹的语言 / 框架 / 抽象选择差异**，而不是需求差异——
这正是把它们并排阅读的价值：同一道题，十种母语的解法。全部 10 个后端均已通过 `verify-contract`（PG + SQLite 双驱动）104/104。

---

## 2. 技术栈速览

| 后端 | 端口 | 语言 | Web 框架 | 数据访问 | 入参校验 | JWT | 密码哈希 | 运行形态 |
|---|---|---|---|---|---|---|---|---|
| **FastAPI** | 29010 | Python 3.12 | FastAPI 0.115 | SQLAlchemy 2.0（ORM） | Pydantic v2 | PyJWT | bcrypt | uvicorn ASGI |
| **Spring Boot** | 29000 | Java 21 | Spring Boot 3（Web MVC） | Spring Data JPA（Hibernate） | Bean Validation + 手写 | java-jwt (auth0) | spring-security-crypto | 胖 JAR（JVM） |
| **Gin** | 29020 | Go 1.22 | Gin 1.10 | GORM | validator + 手写 | golang-jwt | x/crypto bcrypt | 单一静态二进制 |
| **NestJS** | 29040 | TypeScript (Node) | NestJS 11 | TypeORM | class-validator | @nestjs/jwt + passport | bcrypt | node dist |
| **Elysia** | 29030 | TypeScript (Bun) | Elysia 1.4 | **原生 SQL**（`pg` / `bun:sqlite`） | Zod | jose | bcryptjs | `bun src/main.ts` |
| **Ktor** | 29090 | Kotlin | Ktor 2.3（Netty） | Exposed（SQL DSL） | 手写 | java-jwt (auth0) | favre bcrypt | 胖 JAR（JVM） |
| **ASP.NET** | 29050 | C# 12 | ASP.NET Core 8 | EF Core 8 | 手写 | Microsoft.IdentityModel | BCrypt.Net-Next | dotnet DLL |
| **Vapor** | 29060 | Swift | Vapor 4（SwiftNIO） | SQLKit（手写 SQL） | 手写 | **手写 HS256** | Vapor 内置 Bcrypt | release 二进制 |
| **Axum** | 29070 | Rust | Axum 0.8（Tokio） | sqlx（不用宏） | 手写 | **手写 HS256** | bcrypt crate | release 二进制 |
| **Drogon** | 29080 | C++20 | Drogon 1.9 | Drogon ORM（裸 SQL） | 手写（std::regex + 码点） | **手写 HS256** | OpenBSD bcrypt（内嵌源码） | 静态二进制 |

一句话画像：

- **FastAPI** — 参考实现，类型注解 + 异步，分层最"标准教科书"，其余九家对齐它。
- **Spring Boot** — 企业级全家桶，约定优于配置，抽象层最厚（`@Transactional` / `@JdbcType`）。
- **Gin** — 极简、显式、无魔法，错误一律 `if err != nil`，一切摆在明面上。
- **NestJS** — Angular 式 TS 企业框架，装饰器 + DI + 模块化纵切。
- **Elysia** — Bun 原生、函数式、原生 SQL，依赖最少、最"贴金属"。
- **Ktor** — Kotlin 协程 + Exposed DSL + 手动装配，轻量 JVM 教科书。
- **ASP.NET** — EF Core + 中间件管线 + DI，.NET 现代最小宿主。
- **Vapor** — SwiftNIO 全链路 async/await，actor 串行化 SQLite + 手工 JSON 树。
- **Axum** — Rust 类型系统即正确性：`IntoResponse` 让漏接错误编译不过。
- **Drogon** — C++20 协程，把"异步析构提交""catch 不能 co_await"写成必读章。

---

## 3. 代码量对比

**统计口径**：仅计入各后端自己编写的实现源码（主语言），排除 `node_modules / vendor / target / dist / __pycache__` 等依赖与产物，
排除迁移 SQL；**Axum / Drogon 的单元测试内联在源码文件里（`#[cfg(test)]` / assert 风格），无法单列，故计入**。物理行数。

| 后端 | 语言 | 实现行数 | 备注 |
|---|---:|---:|---|
| **Drogon** | C++20 | **4 327** | 最多：头/实现分离 + UUID/JWT/base64url 全手写 + 变参分发样板 |
| **Axum** | Rust | 3 760 | 含内联单测；`Value`/`Cell` 双枚举 + 显式错误传播 |
| **Gin** | Go | 3 130 | Go 风格使然：显式 `if err != nil`、手写 DTO↔model 转换 |
| **Spring Boot** | Java | 2 851 | Java 类型样板 + 两个 `@JdbcType` 跨库类（244 行） |
| **ASP.NET** | C# | 2 789 | 控制器/服务/仓库/中间件分层完整 |
| **Vapor** | Swift | 2 680 | 手工 JSON 树 + 跨库编解码 + 仓储 SQL |
| **FastAPI** | Python | 2 549 | 参考实现；ORM 省掉查询装配 |
| **Ktor** | Kotlin | 2 440 | Kotlin 表达力 + Exposed DSL 紧凑 |
| **NestJS** | TS | 2 431 | 文件最多（~50）、每文件最小，模块化纵切 |
| **Elysia** | TS | **1 719** | 最少：原生 SQL 比 ORM 紧凑 + Bun 内置能力 + 函数式扁平 |

### 怎么读这张表

代码行数 ≈「语言表达力 × 抽象选择 × 手写程度」的合成，而非功能多少（功能都一样）：

- **Drogon / Axum 最多**，不是做得多，而是**手写得多**：C++ 把 UUID、JWT、base64url、变参 SQL 分发全摊在明面上（drogon），
  Rust 用 `Value`/`Cell` 双枚举显式表达跨库类型 + 错误必须显式 `?` 传播（axum）。回报是零隐藏控制流，代价是行数。
- **Gin 居前**是 Go 风格的必然：错误显式返回、无 ORM 隐式装填、DTO↔model 手写转换。
- **Elysia 最少**：原生 SQL 比 ORM 调用更紧凑，函数式扁平组织（少数大文件），Bun 内置 SQLite/密码/测试把样板压到最低。
- **FastAPI / Ktor / NestJS 居中**：ORM/DSL 省掉查询装配代码，但各有声明样板（Pydantic schema / @Serializable DTO / 装饰器）。
- **新增 5 家（Ktor/ASP.NET/Vapor/Axum/Drogon）整体偏多**：因为它们更多选择"手写而非引库"（尤其 JWT、跨库编解码），
  把框架替你做的事显式化，教学透明度高、行数也高。

---

## 4. 架构分层：组织哲学

| 后端 | 组织方式 | 目录骨架 |
|---|---|---|
| FastAPI | 按技术职责分层 | `api / services / repositories / models / schemas / core / db` |
| Spring Boot | 经典 MVC 分层 | `web(controller) / service / repository / domain(entity) / config / db` |
| Gin | Go 标准布局 | `cmd/{server,migrate}` + `internal/{handler,service,model,dto,middleware,core,config,db}` |
| NestJS | 按功能模块（feature module）纵切 | `auth / capsules / plaza / favorites / me / health / llm`，每个内含 controller+service+dto |
| Elysia | 扁平函数式 | `main / services/ / db / llm / security / validation` |
| Ktor | 手动装配分层 | `Application / AppComponents / config / db / repository / service / web / dto / domain` |
| ASP.NET | 控制器分层 | `Program.cs` + `Controllers / Web / Services / Repositories / Infrastructure / Domain / Dto` |
| Vapor | 值类型装配分层 | `entrypoint / AppComponents / Web / Services / Infra / Domain` |
| Axum | 模块分层 | `main / state / config / web / services / infra / domain` |
| Drogon | 头/实现分层 | `main / routes / services / db / repos / security / validation / mapper / *_service` |

- **横切 vs 纵切**：除 NestJS 是"纵切"（先按业务模块切，一个模块自带全套技术层）外，其余九家都是"横切"
  （先按技术层切，同一 feature 的代码散在各层）。Elysia 介于其间，按文件粗分。
- **DI 风格三档**：① 容器/自动装配（Spring 的 `@Service` 扫描、NestJS 的 DI、ASP.NET 的 `AddScoped/AddSingleton`）；
  ② 手动构造函数注入（Ktor `AppComponents`、Vapor `AppComponents`、Axum `AppState`、Drogon `AppState`）；
  ③ 函数 + 闭包注入（Gin 的 `handler(db)`、Elysia 的模块函数、FastAPI 的 `Depends`）。
  新增 5 家里 4 家选**手动装配**——依赖图集中、源码可见、无运行时扫描，刻意为教学保持轻量。
- **分层映射**：项目要求 `presentation → application → domain → infrastructure`。Spring 的 `controller→service→repository→entity`
  与之最贴合；ASP.NET / Ktor / Vapor / Axum 的 `web/routes → services → repos/infra` 同构可逐文件对应。

---

## 5. 数据访问：从原生 SQL 到重型 ORM 的谱系

```
原生 SQL ───────────────────────────────────────────────────────────► 重型 ORM
Elysia    Vapor   Axum   Drogon  │  Gin     Ktor    │  FastAPI  NestJS  ASP.NET  Spring
(手写)   (SQLKit) (sqlx) (裸SQL) │ (GORM)  (Exposed) │ (SQLAlchemy/TypeORM/EF/JPA)
         ── 一份 SQL + 自建编解码 ──   ── 类型安全 query builder ──   ── 对象映射 / 声明式方法名 ──
```

- **最左：手写 / 裸 SQL（Elysia / Vapor / Axum / Drogon）**——SQL 是字符串或参数化 raw，列名手动别名成驼峰；
  跨库差异靠**自建一层值编解码**收敛（见 §6）。控制力最强、行为最透明，代价是样板多、类型安全靠自觉（Vapor/Axum 用枚举补回一部分类型）。
- **中间：query builder（Gin 的 GORM 链式 / Ktor 的 Exposed DSL）**——把表映射成强类型对象，
  列名拼错在编译期报错（Exposed 尤其），但仍能下沉到接近 SQL 的粒度。
- **最右：重型 ORM（FastAPI SQLAlchemy / NestJS TypeORM / ASP.NET EF Core / Spring JPA）**——CRUD 省代码、对象模型自然，
  Spring Data 甚至"方法名即查询"。代价是跨库时抽象层会"反咬一口"（§6 A）。

**权衡规律**：越靠原生 SQL 端，跨库越直白、行数越高、类型安全越靠自觉；越靠 ORM 端，CRUD 越省、跨库适配越要钻进框架底层 SPI。

---

## 6. 同一道难题：PostgreSQL / SQLite 双库适配

约束相同：**同一份业务代码要同时支持 PG 与 SQLite**，而两者在 **UUID** 与 **时间戳** 上语义不同
（PG 有原生 `uuid` / `timestamptz`，SQLite 只有 `TEXT` / `INTEGER`）。十家按"抽象厚度"给出三类解法：

### A. 重型 ORM —— 在类型层挂适配器（5 家）

ORM 不知道怎么把 `uuid`/时间戳 存进 SQLite TEXT，于是各自在**类型/列定义层**插一个转换器：

| 后端 | 机制 |
|---|---|
| FastAPI | SQLAlchemy `Uuid`（SQLite 存 CHAR(32) hex）+ `UTCDateTime` TypeDecorator（读时补 UTC tz） |
| NestJS | `ColumnOptions` 工厂 + `ValueTransformer`（按 `DB_DRIVER` 返回 `text+transformer` 或 `timestamptz`/`uuid`） |
| ASP.NET | EF Core `ValueConverter`（仅 SQLite provider 挂 `GuidToHex` / `TimestampToIso`） |
| Ktor | Exposed 自定义 `ColumnType`（`CrossUuidColumnType` / `CrossTimestampColumnType`，按方言分流 `sqlType()`） |
| Spring | Hibernate 自定义 `@JdbcType` + **自实现 `ValueBinder`**（连 null 也要按方言给正确的 `setNull` 类型） |

> **抽象层最厚 → 跨库要钻得最深**：Spring 的 JPA 平时最省心，但要拗它跨库时必须一路下沉到 Hibernate 的
> `JdbcType` / `ValueBinder` 这种底层 SPI——抽象帮你挡住的复杂度，在边界处原样还回来。

### B. query builder —— 驱动分流 + 行锁分支（2 家）

| 后端 | 机制 |
|---|---|
| Gin | GORM 同时挂 `driver/postgres` 与 `driver/sqlite`；时间/UUID 走 GORM 默认序列化；行锁 `clause.Locking` 仅 PG |
| Ktor | Exposed 列类型按方言分流（同 A 类）；`forUpdate()` 仅在非 SQLite 方言调用 |

（Ktor 同时属 A 与 B：它的跨库列类型是 A 类做法，查询风格是 B 类 DSL。）

### C. 一份 SQL + 自建值编解码层（4 家）

不靠 ORM，业务 SQL 只写一份（`?` 占位，PG 端转 `$n`），差异收敛在"绑定"和"读取"两个点：

| 后端 | 绑定侧 | 读取侧 |
|---|---|---|
| Vapor | `uuidValue/dateValue/boolValue` 助手 | `uuid/date/bool` 助手 |
| Axum | `Value` 枚举（Uuid/Ts/Bool/I64/Str） | `Cell` 枚举 + `DbRow` 访问器（cell-driven） |
| Drogon | 绑定参数**全部 std::string**（文本协议） | `row_get`（统一 `as<string>` 再按格式还原） |
| Elysia | 原生 SQL + `pgSql()` 把 `?`→`$n`；值在 service 里预格式化 | 列别名驼峰，直接取 |

> **更正前一版**：旧文档说 Elysia"在 `db.ts` 内嵌两份完整 DDL schema"——这已过时。Elysia 现在和其余九家一样，
> schema 完全交给 `scripts/db`，`src/` 下不再有 `CREATE TABLE`；`db.ts` 只剩连接 + `query/one/tx` 原语。

**关键不变式（C 类与 A 类的 6 家显式保证）**：SQLite 的 ISO-8601 TEXT 时间戳与 Python seed 的 `isoformat()` 逐字符一致，
使"字符串比较即时间比较"，`open_at <= now` 过滤和 `ORDER BY created_at` 在 TEXT 列上无需任何函数转换——详见 §7。

---

## 7. 时间戳格式：两种策略（读代码后的精确结论）

承 §6 的关键不变式——SQLite 把时间戳存成 TEXT，要让 `open_at <= now` / `ORDER BY created_at` 的**字符串比较**等价于时间比较，
存储格式必须与 seed（Python `isoformat()` → `+00:00`、可变小数）一致。十家其实分两个策略：

| 策略 | 后端 | 做法 |
|---|---|---|
| **① 显式对齐 seed 的 `+00:00`** | Spring / Ktor / ASP.NET / Vapor / Axum / Drogon（6） | 各有专门的 WRITE formatter / 编解码助手，渲染成 `…THH:mm:ss[.fraction]+00:00`（**零偏移写 `+00:00` 而非 `Z`**），与 seed 逐字符相同 |
| **② 交给 ORM/驱动默认** | FastAPI / Gin / NestJS / Elysia（4） | FastAPI 走 SQLAlchemy `DateTime`（空格分隔、无偏移；`UTCDateTime` 只在读时补 tz，不定制存储串）；Gin 走 GORM 驱动默认；NestJS / Elysia 用 `toISOString()`（输出 `…Z` + 固定 3 位毫秒） |

策略 ② 的格式与 seed **并不逐字符相同**，但四家契约仍 104/104——因为：① 同一后端写入与读取/`now` 绑定用同一格式，自身自洽；
② 跨格式比较只在"seed 行与运行时行处于同一秒"时才可能错序，而测试不构造这种场景。这是一处**潜在的边角分歧**，
不影响契约，但说明"字符串比较即时间比较"这条不变式只有显式对齐的 6 家在严格意义上成立。

> 教学价值：这正是"同一道跨库题、不同抽象层导致不同严谨度"的真实案例——手写编解码的 6 家被迫直面格式，
> 反而把不变式钉死；交给 ORM 的 4 家省了事，却把格式一致性悄悄让渡给了框架默认。

---

## 8. 鉴权：库 vs 手写

十家都实现同一套 **JWT(HS256) + refresh token 轮转 + family 追踪**（`refresh_tokens` 表的 `family_id` / `revoked_at`），
差异在"用库还是手写"：

| | JWT | 备注 |
|---|---|---|
| FastAPI / Spring / Gin / NestJS / Elysia / Ktor / ASP.NET（7） | **用库** | PyJWT / java-jwt / golang-jwt / @nestjs/jwt / jose / java-jwt / Microsoft.IdentityModel |
| Vapor / Axum / Drogon（3） | **手写 HS256** | `base64url(header).base64url(payload).HMAC-SHA256`，各 ~20-30 行：swift-crypto `HMAC<SHA256>` / `hmac`+`sha2` crate / OpenSSL `HMAC(EVP_sha256())` |

- 手写三家共同点：校验顺序 = 形态 → 签名（**常数时间比较**：`HMAC.isValidAuthenticationCode` / `verify_slice` / `CRYPTO_memcmp`）→ payload → `exp`；
  过期返回 `access_token_expired`、其余 `invalid_token`（契约区分这两个 message）。
- refresh token 十家一致：32 字节随机 → base64url 下发，落库只存 SHA-256 hex。
- 两个特例：**ASP.NET** 因 `Microsoft.IdentityModel` 强制 HS256 密钥 ≥256 位，用 SHA-256 把任意 secret 派生成 32 字节密钥，
  并设 `ClockSkew = 0` 去掉默认 5 分钟过期宽限；**Spring** 刻意只取 spring-security-crypto 的密码编码器，不引入完整 Security 过滤器链。

---

## 9. 事务一致性：refresh 轮转的四个流派

`refresh_token` 轮转有个安全要点：旧 token 被**重放**时，必须**先提交"整个 family 吊销"、再返回 401**——
若在事务内抛错，会把吊销一起回滚，留下重放缺口。同一个要求，十家给出四种结构：

| 流派 | 后端 | 机制 |
|---|---|---|
| **① 声明式** | Spring | `@Transactional(noRollbackFor = ApiException.class)`——直接 `throw`，靠注解保证吊销不被回滚（**原版**） |
| **② 提交后再抛** | FastAPI | 先 `db.commit()` 提交吊销，再 `raise`（Python 异常不回滚已提交事务） |
| **③ outcome 模式** | Gin / Ktor / ASP.NET / Vapor / Axum / Drogon（6） | 事务内不抛业务错、返回 `Outcome` 枚举（或重放分支返回 nil 让事务提交），**提交后**在事务外把 Reused/Invalid 转成 401 |
| **④ 无事务** | NestJS | `findOne` → 改 → `save`，**既无事务也无行锁**（注释自陈"生产应加行锁/原子操作"，教学简化） |

流派 ③ 是"手写事务"后端模拟流派 ①（Spring 声明式）的产物，各家措辞还互相点名 `noRollbackFor`。
**`favorite_count` 计数**也分两风格：原子 SQL 表达式 `favorite_count + 1`（Gin/Ktor/Vapor/Axum/Drogon/Spring）vs EF 变更跟踪读-改-写
（ASP.NET `capsule.FavoriteCount += 1`，靠 `FOR UPDATE` 行锁保证）；PG 路径普遍用 `SELECT ... FOR UPDATE` 锁胶囊行，SQLite 靠单写事务。

> **NestJS 是唯一不用事务的实现**——见 [`backend-review.md`](backend-review.md) §3-C5。契约全过（教学项目可接受），
> 但"十家事务同构"的叙事对它不成立。

---

## 10. 依赖、构建与运行形态

| 后端 | 直接依赖 | 构建产物 | 启动 | 冷启动直觉 |
|---|---|---|---|---|
| Elysia | ~6 | 无需构建（Bun 直跑 TS） | `bun src/main.ts` | 最快 |
| Vapor | 4（SwiftPM 顶层包） | release 二进制 | `./run`（增量 swift build） | 首次编译数分钟，之后快 |
| ASP.NET | ~6 NuGet | `bin/Release` DLL | `dotnet` | 中（含 JIT 预热） |
| Gin | ~8 直接（+~35 间接） | **单一静态二进制** | `./server` | 极快、零运行时依赖 |
| FastAPI | ~14 | 无（解释执行） | `uvicorn` | 快 |
| Ktor | ~16 | 胖 JAR | `java -jar` (JVM) | 慢（JVM 预热） |
| Axum | ~17 | release 二进制 | `./server` | 首次全量编译最久，产物零依赖 |
| NestJS | ~19 | `dist/`（tsc 编译） | `node dist/main` | 中 |
| Spring Boot | ~11 | 胖 JAR | `java -jar` (JVM) | 慢（JVM 预热） |
| Drogon | 1 大依赖（drogon，FetchContent 静态链接）+ OpenSSL/jsoncpp | 静态二进制（`build-out/`） | `./run` | **首次编译 4-5 分钟**（编 drogon 本体），之后增量 |

- **"轻"的两极**：Elysia 靠运行时（Bun）内置一切把依赖压到最少；Gin / Rust / C++ 靠编译期把一切打进二进制，部署零运行时依赖。
- **JVM 两家（Spring/Ktor）** 启动最慢但运维生态最成熟；**C++（Drogon）** 首次构建成本最高（静态链接框架本体）。
- **NestJS 依赖最多**，是企业框架"电池全包"（DI、Passport、TypeORM、class-validator…）的体现。

---

## 11. LLM 集成

十家各有一个独立 LLM 客户端模块，给"胶囊主题建议 / 推荐"端点供能，且**全部遵守 `CLAUDE.md` 的结构化日志规范**：
请求前 / 成功 / 失败三时机各打一条 `LLM request|response|error`，带 `model / elapsed_ms / tokens / status` 字段，
便于 `grep "LLM "` 统一排查。

| 后端 | LLM 客户端 |
|---|---|
| FastAPI | `app/services/llm_client.py`（**参考实现**，其余对齐它） |
| Spring | `service/LlmClientService.java` |
| Gin | `internal/service/llm.go` |
| NestJS | `src/llm/llm-client.service.ts` |
| Elysia | `src/llm.ts` |
| Ktor | `service/LlmClient.kt` |
| ASP.NET | `src/Services/LlmClient.cs` |
| Vapor | `Services/LlmClient.swift` |
| Axum | `services/llm.rs` |
| Drogon | `src/llm_client.cc` |

共性（移植自参考实现）：只重试瞬时传输错误、坏 JSON 与 HTTP 4xx 不重试、Chrome UA 避 Cloudflare 1010、关闭 `thinking` 提速、
`chat`/`responses`/`auto` 风格切换；建议端点失败走本地模板兜底（`generatedBy=local-template`），推荐端点失败返回空列表（`generatedBy=none`）。
（网关 SSL EOF 重试、CF 1010 改 UA 等坑见 `docs/dev-notes.md`。）

---

## 12. 入参校验与错误处理风格

同一份契约错误码（`VALIDATION_ERROR` 等 8 个 → 对应 HTTP 状态），两种校验路线：

- **声明式 / 库（4 家）**：FastAPI（Pydantic 类型即校验）、NestJS（class-validator 装饰器 + `ValidationPipe`）、
  Spring（Bean Validation `@NotNull/@Size` + `@Valid`）、Elysia（Zod schema 解析）。省代码，但有"魔法"。
- **手写（6 家）**：Gin（validator tag + 手写分支）、Ktor / ASP.NET / Vapor / Axum / Drogon（集中在 `Validation.*`，
  正则 + 长度按**字符/码点**计数，密码"含字母含数字"因多数 regex 引擎不支持 lookahead 改显式扫描）。最透明、也最啰嗦。

错误外壳统一由各家的"出口"兜底：FastAPI exception handler、Spring `@RestControllerAdvice`、Gin `RespondErr`、
NestJS 异常 Filter、Elysia 错误处理、Ktor `StatusPages`、ASP.NET `ErrorHandlingMiddleware`、Vapor `ApiErrorMiddleware`、
Axum `IntoResponse`（**类型系统直接表达，漏接编译不过**）、Drogon `guarded()` 模板。十家最终都产出
`{ success:false, data:null, message, errorCode, details? }`，且分页参数统一"缺失用默认、存在但非整数 → 422"。

---

## 13. 横向总结与"该读哪一个"

| 你想学 / 看 | 首选 |
|---|---|
| 标准、好懂、文档最全的参考 | **FastAPI**（参考实现，879 行手册 + 986 行单测） |
| 企业级 Java、声明式事务、最厚抽象 | **Spring Boot**（`@Transactional` / `@JdbcType`） |
| "没有任何隐藏控制流"的显式风格 | **Gin**（错误显式返回、链式 GORM） |
| 装饰器 + DI + 模块化纵切 | **NestJS** |
| 最少依赖、最贴金属、原生 SQL | **Elysia**（1719 行，Bun 内置一切） |
| Kotlin 协程 + 类型安全 SQL DSL | **Ktor**（Exposed + 挂起事务，初学者友好） |
| .NET 现代最小宿主 + EF Core | **ASP.NET**（DI 生命周期 + ValueConverter） |
| Swift 并发：actor 串行化、async/await 全链路 | **Vapor**（`AsyncGate` 是范例） |
| "用类型系统保证正确性" | **Axum**（`IntoResponse` + `Value/Cell` 双枚举） |
| C++ 协程的真实坑与最贴底层的实现 | **Drogon**（异步析构提交、catch 不能 co_await） |

**最有价值的对照读法**：挑同一条链路（如 `POST /me/favorites` 或 refresh 轮转），在 2-3 家之间并排读——

- **跨库适配**：`backends/spring-boot`（`@JdbcType`）↔ `backends/axum`（`Value/Cell` 枚举）↔ `backends/drogon`（纯文本协议）——同一道题，三种抽象层次。
- **协程并发**：`backends/ktor`（连接池=1）↔ `backends/vapor`（AsyncGate actor）↔ `backends/drogon`（手写 awaitCommit）——三种"协程语言"如何串行化 SQLite 单写、如何处理提交时机。
- **事务安全**：§9 的四个流派，从 Spring 一行 `noRollbackFor` 到 Drogon 的 outcome 枚举 + `awaitCommit`，看同一个安全要求在不同语言里的代价。

这就是这个项目最大的价值：**同一道题，十种母语的解法。**

---

### 附：复现本文数据

```bash
# 代码量（以 drogon 为例，其余替换路径/扩展名；axum/drogon 含内联单测）
find backends/drogon/src \( -name '*.cc' -o -name '*.h' \) -print0 | xargs -0 wc -l | tail -1

# 契约验证（双库，任一后端）
./verification/scripts/verify-contract.sh <fastapi|spring-boot|gin|nest|elysia|ktor|aspnet|vapor|axum|drogon>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <…>
```
