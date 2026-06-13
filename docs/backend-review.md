# HelloTime Pro · 十个后端实现深度 Review 报告

> Review 日期：2026-06-13。对象：`backends/` 下 FastAPI、Spring Boot、Gin、NestJS、Elysia、Ktor、ASP.NET Core、Vapor、Axum、Drogon 十个实现。
> 视角：教学与技术展示项目的定位 —— 契约遵守、跨栈一致性、技术特色展示、代码简洁、文档注释、工程化。
> 姊妹篇：[`backend-comparison.md`](backend-comparison.md) 回答"十家差异在哪"（已于 2026-06-13 扩写至全部 10 家）；本文回答"十家各自做得怎么样、扣分扣在哪"。
> 同系列：[`frontend-review.md`](frontend-review.md)（五前端）、[`fullstack-review.md`](fullstack-review.md)（五全栈）。

---

## 0. 方法与验证

本次 review 实际执行了以下检查（非纯阅读）：

> **2026-06-13 修订**：初版部分结论偏重 TECHNICAL_GUIDE。本次按要求**逐行精读十家源码**（入口/路由/错误/鉴权/跨库数据层/事务/security/LLM 的 signature 文件），据此修正了 §2 的若干过度概括（事务流派、日期格式），新增 §3-C5，并补齐了偏薄的 README/手册（见 §6）。

- **逐行精读十家源码**的 signature 文件：入口装配、路由/控制器、错误外壳、鉴权链路、跨库数据层、事务一致性两案例（收藏计数 + refresh 轮转）、security、LLM 客户端——不再以手册转述为准；
- 通读十家 TECHNICAL_GUIDE 与 README，比对其与源码实际行为的差距；
- 全量 `grep` 校验十家 LLM 日志规范（`LLM request/response/error` 三时机 + 必含字段）；
- 全量扫描代码异味（`TODO/FIXME/HACK`、调试 print、注释掉的代码块）与 `docker compose` 残留；
- 比对十份 README 的数据库准备引导、十份 TECHNICAL_GUIDE 的章节骨架一致性；
- 复核 `spec/api/openapi.yaml` 18 个端点的 `security` 标志与各家鉴权边界；
- 审阅工作区未提交改动（Axum / Drogon / Vapor），判定取舍（见 §5）。

**契约结论以黑盒记录为准**：十家均有 `verify-contract` 双驱动 104/104 通过记录——前 5 家见 `backend-comparison.md`，Ktor（06-05）、ASP.NET（06-06）、Vapor / Axum（06-12）、Drogon（06-13）见 CLAUDE.md。本次 review **未重跑** 全部 104×2×10 用例（耗时数小时且记录新鲜），契约符合性结论来自"记录 + 源码逐层核对"，非现场复验。

**校验结果**：LLM 日志规范 **10/10 合规**；代码异味 **0**（无任何真实 TODO/FIXME/调试输出）；`docker compose` 残留 **0**（后端比前端/全栈干净）。

---

## 1. 总评

这是一组**完成度异常整齐**的多栈后端：同一产品、同一份 `spec/` 契约、同一组 104 黑盒用例、同一个双库约束，十份代码的分层骨架、错误外壳、鉴权边界、事务策略、LLM 客户端行为全部对齐到可逐文件并排阅读的程度。共性强项（§2）远多于问题；发现的问题（§3、§4）几乎都集中在"文档边角不一致"而非功能或质量缺陷。**这个"同一道题、十种母语解法"的承诺是真实成立的。**

**评分（满分 100）**

| 维度（权重） | fastapi | spring-boot | gin | nest | elysia | ktor | aspnet | vapor | axum | drogon |
|---|---|---|---|---|---|---|---|---|---|---|
| 契约与跨栈一致性 (30) | 30 | 30 | 30 | 29 | 29 | 30 | 30 | 29 | 29 | 29 |
| 技术特色展示 (25) | 22 | 22 | 22 | 22 | 22 | 22 | 22 | 23 | 24 | 24 |
| 代码规范与简洁 (20) | 18 | 18 | 18 | 17 | 19 | 19 | 18 | 19 | 19 | 18 |
| 文档与注释 (15) | 14 | 13 | 13 | 12 | 13 | 13 | 13 | 13 | 13 | 13 |
| 工程化：脚本/测试/构建 (10) | 10 | 9 | 8 | 9 | 7 | 8 | 8 | 7 | 8 | 8 |
| **总分** | **94** | **92** | **91** | **89** | **90** | **92** | **91** | **91** | **93** | **92** |

> 分差很小是事实而非和稀泥：十家底子几乎一样好，与前端（92/93/85/91/90）、全栈（93/92/89/87/86）的分布同源。区分度主要落在"技术特色展示"（Axum/Drogon 凭语言独有的硬骨头领先半档）与"工程化"（测试投入与冷启动成本）两栏。

**一句话画像（十家）**

| 后端 | 一句话 |
|---|---|
| **FastAPI** | 参考实现，async + Pydantic + SQLAlchemy，文档/测试最厚，是其余九家的模板与基准。 |
| **Spring Boot** | 企业全家桶，约定优于配置，`@Transactional` + `@JdbcType` 跨库分流，抽象层最厚。 |
| **Gin** | 极简显式、无魔法，错误一律 `if err != nil`，所有控制流摆在明面上。 |
| **NestJS** | 装饰器 + DI + 模块化纵切，结构最规整，代价是文件数量与跳转成本最高。 |
| **Elysia** | Bun 原生、函数式、原生 SQL，依赖最少；已重构出内聚的 `services/` 模块。 |
| **Ktor** | Kotlin 协程 + Exposed DSL + 手动装配，轻量 JVM 的教科书写法。 |
| **ASP.NET** | EF Core + 中间件管线 + DI，跨库 ValueConverter，.NET 现代最小宿主。 |
| **Vapor** | SwiftNIO 全链路 async/await，actor 串行化 SQLite + 手写 JSON 树控显式 null。 |
| **Axum** | Rust 类型系统即正确性：`IntoResponse` 让"漏接错误"编译不过；自研 Value/Cell 跨库层。 |
| **Drogon** | C++20 协程，把"异步析构提交竞态""catch 不能 co_await"两个真实坑写成必读章节。 |

---

## 2. 共性强项（十家通用）

1. **契约遵守扎实，且是黑盒验证过的**。响应外壳 `{success, data, message, errorCode}` 统一；422 `VALIDATION_ERROR` 带逐字段 `details`；401/403/404/409/429/500 错误码与 message 全部对齐 spec；分页参数"缺失→默认、存在但非整数→422"十家一致（手写 `intParam` 而非框架默认 400）；匿名可带态端点（广场列表/胶囊详情）用 `optional` 鉴权，受保护端点首行 `required`。十家逻辑逐行等价。

2. **LLM 日志规范 10/10 合规**。`LLM request / LLM response / LLM error` 三时机，必含字段（`model=`、`elapsed_ms=`、`tokens=`（缺失记 `n/a`）、`status=`/`error=`）全部落实；参考实现 `fastapi/llm_client.py` 的取舍——只重试瞬时传输错误、坏 JSON 不重试、Chrome UA 避 Cloudflare 1010、关 `thinking` 提速、跳过死的 `/responses` 端点——被九家逐一移植，且各自加了语言注释解释"为什么"。

3. **跨库双驱动各显神通，是本项目最有价值的对照面**。同一道"PG 原生 uuid/timestamptz vs SQLite hex+ISO TEXT"题，十种解法：SQLAlchemy 类型装饰（fastapi）、JPA `@JdbcType` 分流（spring）、GORM + 手写转换（gin）、Exposed `CrossDbColumns`（ktor）、EF Core `ValueConverter`（aspnet）、SQLKit 编解码助手（vapor）、自研 `Value`/`Cell` 枚举（axum）、全 `std::string` 文本协议（drogon）。**关键不变式**：SQLite 的 ISO-8601 TEXT 与 Python seed 的 `isoformat()` 逐字符一致，使"字符串比较即时间比较"，`open_at <= now` 过滤和 `ORDER BY created_at` 在 TEXT 列上无需任何函数转换。读代码后需补一条诚实注脚（精确结论见 [`backend-comparison.md`](backend-comparison.md) §7）：**真正逐字符对齐 seed（`+00:00`、可变小数）的只有 6 家**——spring 与新 5 家（ktor/aspnet/vapor/axum/drogon），各有专门的 WRITE formatter / 编解码助手，把零偏移渲染成 `+00:00` 而非 `Z`。**其余 4 家交给 ORM/驱动默认**：fastapi 走 SQLAlchemy `DateTime`（空格分隔、无偏移，`UTCDateTime` 只在读时补 tz、不定制存储串）、gin 走 GORM 驱动默认、nest/elysia 用 `toISOString()`（`…Z` + 固定 3 位毫秒）。这 4 家的存储格式与 seed 并不逐字符相同——契约仍 104/104（同秒跨格式比较在测试里不发生），属潜在边角分歧，见 §3-C5。

4. **事务一致性的两个硬骨头，九家处理到位、解法分四个流派**（逐文件读代码后修正——nest 是例外，见 §3-C5）。
   - (a) `favorite_count` 冗余计数器：与 favorites 行变更同事务 + 原子 SQL 自增（`favorite_count + 1`），并发 5 连击不重复计数（契约有专门用例）。判定"是否真插入"各有手法：axum/vapor/gin 用 UPSERT `ON CONFLICT DO NOTHING`，fastapi 用 select-then-insert + 原子 update，PG 路径普遍加 `SELECT ... FOR UPDATE` 行锁。
   - (b) refresh token 轮转的安全细节：旧 token 重放时**必须先提交家族吊销、再返回 401**（事务内抛错会把吊销一起回滚）。读代码后看到这其实是**四种解法**：① **Spring** 用 `@Transactional(noRollbackFor = ApiException.class)` 声明式直接 throw（原版）；② **fastapi** 显式 `commit()` 后再 `raise`（Python 异常不回滚已提交事务）；③ **ktor/aspnet/vapor/axum/drogon/elysia** 用 outcome 枚举：事务内不抛业务错、提交后再转 401（模拟 Spring 的 noRollbackFor）；④ **nest** 既无事务也无行锁（注释自陈为教学简化）。互相点名等价物（都指向 Spring `noRollbackFor`）是这处教学价值最高的共识。

5. **跨栈概念引用作为教学装置，普遍且自然**。注释与手册里"这相当于 X 的 Y"的类比（Exposed `CrossDbColumns` ≈ Spring 自定义 JDBC type ≈ EF Core ValueConverter；Axum 池=1 ≈ Vapor AsyncGate actor ≈ Ktor 连接池大小 1；十家校验栈对齐同一错误壳）让读者能"从已知栈跳到未知栈"，正是多栈教学项目想要的。**九家一致采用，唯一例外见 §3-C1。**

6. **文档分量与结构一致性在教学项目里属上乘**。十家都有 README + TECHNICAL_GUIDE（216–879 行），且共享同一章节骨架：选型理由 → 整体地图 → 运行验证 → 入口 → 分层逐层 → 事务/鉴权/校验/LLM → 测试 → **常见改动指南** → **读代码的路线**。fastapi 最厚（21 章，含两段"从真实请求读代码"走查 + "初学者常见困惑"）。注释风格统一且有信息量：文件头交代职责与取舍，行内注释解释"为什么"（竞态、回滚语义、协程限制）而非复述代码。

7. **代码整洁度全员达标**。全量扫描下 **0 处真实 `TODO/FIXME/HACK`、0 处调试 print、0 处注释掉的死代码**；run 脚本严守"不建表、不迁移、不 seed"约定，数据库生命周期一律交给仓库级 `scripts/db`。

---

## 3. 跨栈问题（不归咎于单家，但应收敛）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| **C1** | **跨栈概念引用被裁剪得不一致**：工作区未提交改动把 Vapor 代码注释 + 手册里的"对应 Ktor 的 X""等价连接池大小=1""≈ explicitNulls=true"等引用全部删除，使 Vapor 成为**十家中唯一无任何跨栈引用**的后端。而 Axum / Drogon / Ktor / ASP.NET 的手册与注释都把这类概念类比当教学手段保留，且读起来很自然（§2-5）。 | 破坏"互相点名"的教学一致性；Vapor 读者失去跳转锚点 | **二选一并贯彻到底**：(a) 恢复 Vapor 的**概念性**引用（推荐，与其余 4 家新后端 + 项目 fullstack-review 理念一致）；(b) 若决定"每家独立可读、不互引"，则同时清掉 Ktor/ASP.NET/Drogon/Axum 的引用。不要只清一家。详见 §5。 |
| **C2** | **NestJS README 未引导 `scripts/db`**：快速开始写 `# PostgreSQL（需先启动 Postgres）` + `./run`，是**十家中唯一**不提 `../../scripts/db reset --seed` 的 README。其余九家都明确引导先准备数据库。 | 照 README 直接 `./run` 会连到空库，新手踩坑；与项目"后端不建表"约定脱节 | **本轮已修**：nest README 快速开始已补 `../../scripts/db reset --seed` 并标注"后端不建表/迁移/seed"，与其余九家对齐。 |
| **C3** | **`backend-comparison.md` 已陈旧**：数据截至 2026-06-03，标题与正文只覆盖前 5 家（FastAPI/Spring/Gin/Nest/Elysia），后写的 Ktor/ASP.NET/Vapor/Axum/Drogon 五家完全缺席；且其中"Elysia 是少数大文件、几乎无类"的描述已被 Elysia 重构出 `services/` 模块的事实推翻。 | 对比文档与现状脱节，读者按它会误判规模与结构 | **本轮已修**：`backend-comparison.md` 已重写为 10 家横向对比（含 LOC 重测、事务四流派、时间戳两策略、JWT 库 vs 手写），并更正 Elysia 内嵌 schema 的陈旧描述。 |
| **C4** | **单元测试口径差异大**：fastapi 986 行 pytest（参考实现）、drogon 35 / axum 25 / vapor 13 项纯函数断言，而 gin/nest/elysia/spring 主要依赖仓库级 104 黑盒用例。 | 符合项目"外部黑盒为准"总原则，但"测试"章节的示范厚薄不均 | 可接受现状；若要统一示范，给纯逻辑薄的几家补齐 iso_date/validation/jwt 同口径单测即可。 |
| **C5** | **nest 的事务/格式与其余九家不齐**（逐行读代码发现）：① `favorites.service` 的"插 favorites 行 + `favorite_count+1`"是**两条独立 autocommit 语句**、`refresh` 也无事务/行锁（均有注释自陈"生产应加事务/行锁"，符合项目教学定位但偏离九家口径）；② nest/elysia 时间戳用 `toISOString()`（`Z` 格式）而非 seed 的 `+00:00`（见 §2-3）。另：nest `addFavorite` 有一行 `increment(id,'favoriteCount',0)`（自增 0）的无效"刷新"调用，疑似残留。 | 契约全过（教学项目可接受），但"十家同构"的并发/格式叙事对 nest 不成立 | 若要对齐：nest 两处套 `DataSource.transaction(...)`、日期改 `+00:00` formatter、删掉 `increment(...,0)`。或在 nest 文档显式声明这些为有意的教学简化。 |

---

## 4. 各家详评

> 每家给"定位 / 亮点 / 问题"。亮点只记**这一家独有或做得最好**的点，共性强项不重复（见 §2）。

### 4.1 FastAPI（94）— 参考实现

**定位**：Python async + Pydantic v2 + SQLAlchemy 2.0，分层最"标准教科书"，是其余九家的模板与基准。

**亮点**
- `llm_client.py` 是全项目 LLM 客户端的金标准：`responses/chat/auto` 三风格切换、瞬时错误重试、坏 JSON 与 HTTP 4xx 不重试、token 用量提取、Cloudflare UA 规避，注释全在解释"为什么"。九家逐一对齐它。
- TECHNICAL_GUIDE 21 章最厚，独有"从真实请求读代码：注册 / 创建胶囊"两段端到端走查 + "初学者常见困惑"章——教学体验最完整。
- 自带 986 行 pytest，是十家里唯一有成规模单测的实现，工程化满分。

**问题**
- 作为参考实现，"技术特色展示"分天然偏保守（模式原创性记在它头上，但读者已在别处见过同款 async 写法）；非缺陷。

### 4.2 Spring Boot（92）

**定位**：Java 21 + Spring Boot 3 + Spring Data JPA，企业级全家桶，抽象层最厚，`controller→service→repository→entity` 与项目要求的四层映射最贴合。

**亮点**
- 跨库分流用自定义 `@JdbcType` + 自实现 `ValueBinder`（处理 null），是 JVM 系读者最熟悉的样板；改 db 脚本后双驱动复验的纪律到位。
- 真 `@Transactional` + Flyway 参考脚本，把"生产级做法"诚实地展示出来（与某些栈"文档化为什么不做事务"形成有益反差）。

**问题**
- ~~README 仅 24 行，是十家最短，缺"设计特色"要点列表。~~ **本轮已补**（24 → ~95 行，对齐 ASP.NET/Ktor 的 house style：技术栈表、分层目录、实现特色、验证、注意事项；内容取自实读代码，见 §6）。

### 4.3 Gin（91）

**定位**：Go 1.22 + Gin + GORM，极简显式、无魔法，所有控制流摆在明面上。

**亮点**
- handler 形态极薄且零隐藏分支：`CurrentUser → ShouldBindJSON → service → dto.OK`，错误一律显式 `RespondErr` 早返回（见 `internal/handler/capsule.go`），是"没有任何隐藏控制流"的最佳示范。
- Go 标准布局 `cmd/{server,migrate}` + `internal/{handler,service,...}`，分层清晰。

**问题**
- 代码量最大（comparison 实测 3130 行）是 Go 风格的必然代价（手写 DTO↔model 转换、显式错误传播），非缺陷，但读者需有"冗长换透明"的预期。

### 4.4 NestJS（89）

**定位**：NestJS 11 + TypeORM + Passport JWT，装饰器 + DI + 模块化"纵切"，结构最规整。

**亮点**
- `EnvelopeInterceptor` 统一响应壳 + 异常 `Filter` 统一错误壳 + `Guard` 鉴权，是 Nest 生态最地道的横切关注点处理；每个 feature 模块 `controller/service/dto` 自带全套，规整度十家第一。

**问题**
- **唯一不用事务的实现**（逐行读代码发现，§3-C5）：`favorites.service` 的 INSERT + `favorite_count+1` 是两条独立 autocommit 语句、`refresh` 无事务也无行锁——均有诚实注释自陈"生产应加事务/行锁"，符合教学定位，但使"十家事务同构"对 nest 不成立。另有一行 `increment(id,'favoriteCount',0)`（自增 0）的无效调用疑似残留。
- 时间戳用 `toISOString()`（`Z` 格式）而非 seed 的 `+00:00`，与跨库"逐字符对齐"叙事不符（潜在边角，§2-3）。
- 文件数量最多、单文件最小（comparison：50 文件 / 52 行每文件），跳转成本最高——这是 Nest 的固有取舍而非质量缺陷，但教学读者首次通读负担偏大。
- ~~README 快速开始未引导 `scripts/db`~~（§3-C2）：**本轮已补**，与其余九家对齐。

### 4.5 Elysia（90）

**定位**：TypeScript on Bun，原生 SQL（`pg` / `bun:sqlite`）、函数式、依赖最少（5 个直接依赖）、最"贴金属"。

**亮点**
- 自 comparison 后已**重构**：从单个大 `services.ts` 拆成内聚的 `services/{auth,capsules,plaza,favorites,ai}.ts` + barrel 重导出，可读性显著提升，是十家里唯一有"演进痕迹"的实现。
- Bun 内置 SQLite/密码/测试能力把样板压到最低，schema 内嵌 `db.ts`，启动链路最短。

**问题**
- 类型安全靠自觉（原生 SQL 无编译期列校验），单文件仍偏大（`main.ts` 8.5KB / `llm.ts` 7.3KB）；纯逻辑单测薄，工程化分偏低。

### 4.6 Ktor（92）

**定位**：Kotlin + Ktor + Exposed + HikariCP，插件式轻量 JVM 服务，手动 `AppComponents` 装配。

**亮点**
- 手册最适合初学者（开篇明确"面向已懂 Kotlin 但没接触过 Ktor/Exposed 的读者"），路由"显式、集中、薄"，`install(...)` 显式组合插件，与 Spring 自动装配形成清晰对照。
- `CrossDbColumns.kt` 自定义 UUID/时间戳列类型，手册点名它"对应 Spring 自定义 JDBC type、ASP.NET ValueConverter"——跨栈引用的范例。

**问题**
- 无明显短板；`AppComponents` 手动维护构造顺序的代价手册已诚实说明，规模再大才需 DI 容器。

### 4.7 ASP.NET Core（91）

**定位**：C# 12 + ASP.NET Core 8 + EF Core 8，中间件管线 + DI，.NET 现代最小宿主。

**亮点**
- 诚实展示 .NET 特有坑并给出解法：禁用 `[ApiController]` 自动 400 以统一 422；`Microsoft.IdentityModel` 要求 HS256 密钥 ≥256 位，于是 `SecurityService` 用 SHA-256 从短 `JWT_SECRET` 派生 32 字节签名密钥——这类"框架约束 vs 契约要求"的调和是高质量教学点。
- `CrossDb.cs` + `ApplySqliteConverters()` 仅在 SQLite provider 下挂转换器，PG 交给 Npgsql 原生映射，边界干净。

**问题**
- 无原则性问题；与 Ktor 同属"扎实但不抢戏"的一档。

### 4.8 Vapor（91）

**定位**：Swift + Vapor 4 + SwiftNIO，全链路 `async throws`，SQLKit 手写 SQL。

**亮点**
- **actor 串行化 SQLite**：`AsyncGate`（actor 实现的 FIFO 异步互斥）把单连接访问串行化，是 Swift 并发模型的地道展示；配合 `LoginRateLimiter` actor，把"有状态共享"全部收进 actor。
- **手写 `JSON` 枚举树**替代 Codable 合成：因契约用 strict equal 断言 `data`/`errorCode` 为**显式 null**，而 Swift 合成 Encodable 对 Optional 走 `encodeIfPresent` 直接丢键——这个"为什么不用语言默认"的取舍讲得很透。
- 独有"目录为什么叫 `server`"的踩坑记录（SwiftPM 根包身份与依赖包 `vapor` 同名导致 cyclic dependency）。

**问题**
- 跨栈引用在未提交改动中被清空（§3-C1），需就方向统一。
- 冷启动需先 `./build` 预热（release 编译数分钟），否则契约脚本 60s 就绪窗口超时——手册已警示，但工程化体验上是个真实摩擦。

### 4.9 Axum（93）

**定位**：Rust + Axum 0.8 + Tokio + sqlx（不用宏检查），类型系统即正确性工具。

**亮点**
- **`IntoResponse` 让错误处理变成类型问题**：handler 返回 `ApiResult<Response>`，任何 `?` 直接产出契约错误外壳，"漏接异常"在 Rust 里编译不过——手册明确与 Vapor 的"中间件 catch"对照，是十家里把"语言特性当正确性保障"展示得最彻底的。
- **自研 `Value`/`Cell` 跨库编解码层**：绑定侧 `Value` 枚举、读取侧 `Cell` 枚举（cell-driven 而非 driver-driven），SQL 文本完全共享；显式 `BEGIN/finish` 事务模式绕开 sqlx `Transaction` 类型在 enum 两臂分叉的问题。手册解释了"为什么不用 `sqlx::Any` / `query!` 宏"——选型理由扎实。
- 工作区已把 `Cargo.toml` 里未使用的 sqlx `macros` feature 删除（验证：源码无 `query!`/`query_as!`，走运行时 `fetch_opt/execute`），依赖更干净。

**问题**
- 无原则性问题；`?`→`$n` 占位替换依赖"SQL 文本不含字面 `?`"的约定，手册已声明，属可接受的工程约束。

### 4.10 Drogon（92）

**定位**：C++20 + Drogon 1.9，协程（`co_await`）+ 裸 SQL + 全文本协议绑定。

**亮点**
- **把两个 C++ 协程真坑写成必读章节**：(a) §7 "异步析构提交竞态"——drogon `Transaction` 在最后一个 shared_ptr 析构时**异步**发 COMMIT，导致"响应已发→下一请求路由到另一连接→读不到刚写的数据"，解法 `awaitCommit`（`CallbackAwaiter` 包 `setCommitCallback`）等提交落地再返回；(b) §8 "catch 里不能 co_await"，三处异步补救全部改写成"catch 记 flag、try 外 co_await"。这是全项目最有价值的语言级战例。
- **`third_party/openbsd_bcrypt` 来历透明**：C++ 无标准 bcrypt，原样复制本仓库 nest 的 `node_modules/bcrypt` 内嵌 OpenBSD 实现（保留 ISC 版权头），理由"已在依赖树内、零新增外部来源"讲得清楚。
- 工作区已把 `Db::query` 的变参绑定档位从 10 扩到 16 并加注释（"当前最大用量 10，上限 16 按需扩档"）——健壮性 + 可读性小修，合理。

**问题**
- 构建成本最高：FetchContent 静态链接 drogon 本体，首次编译 4–5 分钟（手册已警示）；构建目录改名 `build-out/`（避让同名 `build` 脚本）也是个小认知负担。
- §11 昵称校验为绕 `std::regex` 不支持 `\p{L}\p{N}`，对 ≥U+0080 一律放行（比 Unicode 属性表略宽）——手册已声明为教学项目可接受的取舍。

---

## 5. 未提交改动（工作区 WIP）的处置建议

本次 review 审阅了工作区三处未提交改动，结论：

| 改动 | 判定 | 理由 |
|---|---|---|
| **Drogon `db.cc`** 变参档位 10→16 + 注释 | ✅ 保留 | 纯健壮性 + 可读性，无副作用 |
| **Axum `Cargo.toml`** 删 sqlx `macros` feature | ✅ 保留 | 已验证源码不用 `query!`/`query_as!` 宏（走运行时 `fetch_opt/execute`），删除安全、依赖更干净 |
| **Vapor 删除跨栈引用**（10+ 处 + PlazaService 重构） | ⚠️ 需定向 | PlazaService 的 `let` 绑定重构是纯改进，**保留**；但跨栈引用删除使 Vapor 成为十家唯一无引用者（§3-C1），与其余 4 家新后端 + 项目理念冲突，**建议恢复概念性引用** |

C1 是个需要**用户拍板的方向性决定**（教学文档风格 + 我对先前 WIP 意图无完整上下文），两个方向都自洽。**本次 review 经确认：暂不改动工作区，三处 WIP 保持现状，C1 留作后续处理。**

---

## 6. 偏薄文档的补齐（2026-06-13，基于源码精读）

读完十家源码后，按"代码确实做了、但文档没讲到"的标准补齐偏薄的文档——只补实质内容、不灌水凑行数。aspnet（296）、ktor（307）两份手册经核对覆盖无缺口，未做填充式补写。

| 文档 | 补前 | 动作 |
|---|---|---|
| **spring-boot/README.md** | 24 行 | → ~95 行。对齐 house style 补：技术栈表、分层目录、切换驱动、**实现特色**（`@JdbcType`+自实现 `ValueBinder` 跨库、`@Transactional(noRollbackFor)`、`FOR UPDATE` 行锁、Flyway 样例、统一错误外壳）、验证、手册链接。 |
| **vapor/TECHNICAL_GUIDE.md** §7 | 只点名 `AsyncGate` | 补出 actor + `CheckedContinuation` 的 FIFO 门闩**实现与原理**（为什么用 actor、为什么不阻塞线程、为什么 FIFO）。 |
| **drogon/TECHNICAL_GUIDE.md** §7 | 只点名 `awaitCommit` | 补出 `CommitAwaiter`（`CallbackAwaiter` + `setCommitCallback` + `trans_.reset()`）的**实现**与"先挂回调再 reset"的关键顺序。 |
| **axum/TECHNICAL_GUIDE.md** §7.3 | 只说"cell-driven" | 补出 PG 侧（按类型名还原）与 SQLite 侧（仅 3 存储类、靠访问器反解）解码的**不对称**，解释为何按存储类而非声明类型分发。 |

> 共性观察：后写 5 家的手册偏"参考手册"风格（精炼、覆盖完整），缺的是前 5 家那种"把最核心机制的实现摊开讲"的教学深度。本轮的补法是给每家最具代表性的机制补一段代码级展开，而非整体拉长。
