# HelloTime Pro · 五个后端实现全面对比

> 对比对象：`backends/` 下已完成并通过契约验证的 5 个后端
> —— **FastAPI**（参考实现）、**Spring Boot**、**Gin**、**NestJS**、**Elysia**。
> 数据采集日期：2026-06-03。代码量为物理行（`wc -l`，含注释空行），统计口径见 §3。
> 姊妹篇：前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)，全栈对比见 [`docs/fullstack-comparison.md`](fullstack-comparison.md)；单栈深读见各后端目录下的 `TECHNICAL_GUIDE.md`。

---

## 1. 为什么这五个能放在一起比

它们实现的是**同一个产品**，且共享 `spec/` 这一份单一事实来源：

- 同一份 API 契约（`spec/api/openapi.yaml`）；
- 同一套数据库 schema 语义（`spec/db/schema.sql`）；
- 同一组 **104 个黑盒契约用例**（`verification/`），从外部验证，不关心内部实现；
- 同一个双库约束：每个后端都要同时跑通 **PostgreSQL 和 SQLite**。

这意味着五者之间的所有差异都是**纯粹的语言 / 框架 / 抽象选择差异**，而不是需求差异——
这正是把它们并排阅读的价值：同一道题，五种母语的解法。

全部 5 个后端均已通过 `verify-contract`（PG + SQLite 双驱动）。

---

## 2. 技术栈速览

| 维度 | FastAPI | Spring Boot | Gin | NestJS | Elysia |
|---|---|---|---|---|---|
| 语言 | Python 3.12 | Java 21 | Go 1.22 | TypeScript (Node) | TypeScript (Bun) |
| Web 框架 | FastAPI 0.115 | Spring Boot 3 (Web MVC) | Gin 1.10 | NestJS 11 | Elysia 1.4 |
| 数据访问 | SQLAlchemy 2.0（ORM） | Spring Data JPA（Hibernate） | GORM | TypeORM | **原生 SQL**（`pg` / `bun:sqlite`） |
| 迁移 | Alembic（Python DSL） | Flyway（SQL） | golang-migrate（SQL） | 由仓库级 `scripts/db` 统一 | 内置 schema 字符串 |
| JWT | PyJWT | java-jwt (auth0) | golang-jwt | @nestjs/jwt + passport-jwt | jose |
| 密码哈希 | bcrypt | spring-security-crypto (BCrypt) | x/crypto bcrypt | bcrypt | bcryptjs |
| 入参校验 | Pydantic v2 | Bean Validation | validator + 手写 | class-validator | Zod |
| 运行形态 | uvicorn ASGI | 胖 JAR (JVM) | 单一静态二进制 | node dist | `bun src/main.ts` |
| 直接依赖数 | 10 | 11 | 8（+~35 间接） | 18 | **5** |

一句话画像：

- **FastAPI** — 参考实现，类型注解 + 异步，分层最“标准教科书”。
- **Spring Boot** — 企业级全家桶，约定优于配置，抽象层最厚。
- **Gin** — 极简、显式、无魔法，一切都摆在明面上。
- **NestJS** — Angular 式的 TS 企业框架，装饰器 + DI + 模块化。
- **Elysia** — Bun 原生、函数式、原生 SQL，依赖最少、最“贴金属”。

---

## 3. 代码量对比

**统计口径**：仅计入各后端自己编写的实现源码（主语言），排除 `node_modules / vendor / target / dist / __pycache__` 等依赖与产物，
排除单元测试与迁移 SQL（单列）。物理行数。

| 后端 | 语言 | 实现文件数 | 实现行数 | 行 / 文件 | 单测行数 | 迁移 / Schema |
|---|---|---:|---:|---:|---:|---|
| **Gin** | Go | 30 | **3 130** | 104 | —(黑盒为主) | 183 行（2 份 SQL）|
| **Spring Boot** | Java | 38 | 2 851 | 75 | 120 | 258 行（4 份 Flyway SQL）|
| **NestJS** | TS | 50 | 2 600 | 52 | —(黑盒为主) | —(仓库级 scripts/db) |
| **FastAPI** | Python | 46 | 2 549 | 55 | 986 | 269 行（Alembic，Python）|
| **Elysia** | TS | 11 | **1 839** | 167 | —(黑盒为主) | schema 内嵌于 `db.ts` |

### 怎么读这张表

代码行数 ≈「语言表达力」与「抽象选择」的合成函数，而不是功能多少（功能都一样）：

- **Gin 最多（3 130 行）但不是因为做得多，而是 Go 的风格使然**：错误必须显式 `if err != nil { return ... }`、
  没有 ORM 的隐式装填、DTO ↔ model 之间要手写转换。`internal/service` 一层就占 1 640 行——
  业务逻辑和数据装配都摊在明面上。代价是冗长，回报是**没有任何隐藏控制流**。
- **Elysia 最少（1 839 行）且文件最大（167 行/文件）**：原生 SQL 比 ORM 调用更紧凑，函数式扁平组织
  （`services.ts` / `db.ts` 等少数大文件，没有一层层的类），加上 Bun 内置 SQLite/测试/密码能力，
  样板代码被压到最低。代价是单文件偏大、类型安全靠自觉。
- **NestJS 文件最多（50 个）但每文件最小（52 行）**：装饰器 + 模块化把每个 feature 拆成
  `module / controller / service / dto / entity` 一组小文件，结构极其规整，代价是文件数量爆炸、跳转成本高。
- **FastAPI / Spring 居中**：ORM 省掉了查询装配代码（相比 Gin），但 Spring 有 Java 的类型样板、
  FastAPI 有 Pydantic schema 的显式声明。两者都体现“分层清晰、各司其职”。
- **测试行数**反映测试策略差异：FastAPI 作为参考实现自带 986 行单测（pytest），Spring 有少量切片测试，
  其余三者主要依赖仓库级的 104 个黑盒契约用例（符合本项目“外部黑盒验证为准”的总原则）。

### 分层行数分布（节选）

```
FastAPI/app          Gin/internal
  services  1173       service   1640
  api        385       handler    499
  schemas    298       dto        238
  core       222       core       199
  models     129       config     142
  db         107       middleware 133
  repositories  6      db          77
                       model       49
```

> 有意思的对照：FastAPI 的 `repositories` 只有 6 行——它把数据访问直接交给 SQLAlchemy ORM 在 service 层完成；
> 而 Gin 没有独立 repository 目录，数据访问也压进了 `service`。两种“薄仓储”路线殊途同归，
> 都把重量集中在 service 层（1173 vs 1640 行）。

---

## 4. 架构分层：五种组织哲学

| 后端 | 组织方式 | 目录骨架 |
|---|---|---|
| FastAPI | **按技术职责分层** | `api / services / repositories / models / schemas / core / db` |
| Spring Boot | **经典 MVC 分层** | `web(controller) / service / repository / domain(entity) / config / db` |
| Gin | **Go 标准布局** | `cmd/{server,migrate}` + `internal/{handler,service,model,dto,middleware,core,config,db}` |
| NestJS | **按功能模块（feature module）** | `auth / capsules / plaza / favorites / me / health / llm / …`，每个内含 controller+service+dto |
| Elysia | **扁平函数式** | `main / routes / services / db / llm / config`，少数大文件，几乎无类 |

- **横切 vs 纵切**：FastAPI / Spring / Gin 是“横切”（先按技术层切，同一 feature 的代码散在各层）；
  NestJS 是“纵切”（先按业务模块切，一个模块自带全套技术层）。Elysia 介于其间，按文件粗分。
- **分层映射**：项目要求后端遵循 `presentation → application → domain → infrastructure`。
  Spring 的 `controller→service→repository→entity` 与之最贴合，是 Java 系读者的首选样板；
  FastAPI 的 `api→service→model` 是 Python 系最直观对应。

---

## 5. 数据访问：从原生 SQL 到重型 ORM 的谱系

把五者按“距离 SQL 的远近”排成一条谱系，是理解它们最快的方式：

```
原生 SQL ───────────────────────────────────────────► 重型 ORM
Elysia          Gin            FastAPI / NestJS         Spring Data JPA
(手写 SQL)   (GORM 链式)    (SQLAlchemy / TypeORM)   (声明式方法名 + JPQL)
```

**一端：Elysia 手写 SQL**（`src/services.ts`）——查询就是字符串，列名手动别名成驼峰：

```sql
SELECT c.id, c.owner_id AS "ownerId", c.open_at AS "openAt",
       c.in_plaza AS "inPlaza", c.favorite_count AS "favoriteCount"
FROM capsules c WHERE c.id = ? AND c.in_plaza = ?
```

**另一端：Spring Data JPA**（`repository/CapsuleRepository.java`）——大部分查询连 SQL 都不用写，
方法名即查询；复杂查询用 JPQL（面向对象而非面向表）：

```java
public interface CapsuleRepository extends JpaRepository<CapsuleEntity, UUID> {
  Optional<CapsuleEntity> findByCode(String code);
  Page<CapsuleEntity> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId, Pageable pageable);

  @Modifying
  @Query("update CapsuleEntity c set c.favoriteCount = c.favoriteCount + 1 where c.id = :id")
  int incrementFavoriteCount(@Param("id") UUID id);

  @Query("""
      select c from CapsuleEntity c
      where c.inPlaza = true
        and ( :filter = 'all' or (:filter='opened' and c.openAt <= :now) or … )
      """)
  Page<CapsuleEntity> findPlazaPage(…);
}
```

**中间地带**：Gin 的 GORM（链式 query builder + struct tag）、FastAPI 的 SQLAlchemy 2.0（`select()` 构造器）、
NestJS 的 TypeORM（Repository API + QueryBuilder）——都是“对象化的 SQL”，把表映射成类型，但仍能下沉到接近 SQL 的粒度。

**权衡**：越靠原生 SQL 端，控制力越强、行为越透明、跨库越直白（见 §6），但样板越多、类型安全越靠自觉；
越靠 ORM 端，CRUD 越省代码、对象模型越自然，但跨库时抽象层会“反咬一口”（Spring 的例子见下节）。

---

## 6. 同一道难题的五种解法：PostgreSQL / SQLite 双库适配

这是整个项目最能体现差异的地方。约束相同：**同一份业务代码要同时支持 PG 与 SQLite**，
而两者在 **UUID** 和 **时间戳** 上语义不同（PG 有原生 `uuid` / `timestamptz`，SQLite 只有 `TEXT`）。
五个后端给出了五种截然不同的解法，且呈现一条清晰规律。

### ① Elysia：维护两份 schema + 运行时分流

最直白。`db.ts` 里直接放两份完整 DDL 字符串（`pgSchema` / `sqliteSchema`），
查询时按 handle 类型分流，并把 `?` 占位符转成 PG 的 `$1,$2`：

```ts
function pgSql(sql: string) {            // ?  →  $1, $2, …
  let i = 0; return sql.replace(/\?/g, () => `$${++i}`);
}
// PG: UUID 列 + TIMESTAMPTZ;  SQLite: TEXT(36) + TEXT(ISO)
```

### ② FastAPI：SQLAlchemy `TypeDecorator`

在 ORM 类型层补一块。`UTCDateTime` 解决“SQLite 读出的 datetime 丢了时区”问题，
读写时强制补 UTC，让上层永远拿到 tz-aware：

```python
class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
```

### ③ NestJS：`ColumnOptions` 工厂 + `ValueTransformer`

按 `DB_DRIVER` 返回不同的列定义，时间用 transformer 在 `Date ↔ ISO 字符串`间转换：

```ts
export function timestampColumn(): ColumnOptions {
  return isSqlite() ? { type: 'text', transformer: dateTransformer } : { type: 'timestamptz' };
}
export function uuidColumn(): ColumnOptions {
  return isSqlite() ? { type: 'text' } : { type: 'uuid' };
}
```

### ④ Gin：双 driver + 分库 SQL 迁移

GORM 同时挂 `driver/postgres` 与 `driver/sqlite`，迁移文件按库分目录
（`migrations/postgres/` 与 `migrations/sqlite/`），让 SQL 各写各的，代码层几乎不感知差异。

### ⑤ Spring Boot：自定义 Hibernate `JdbcType` + 自实现 `ValueBinder`

**抽象层最厚，于是跨库要钻得最深**。`CrossDbUuidJdbcType` 继承 `VarcharJdbcType`，按方言分流：
PG 用 `setObject`/`getObject` 直传 `UUID`，SQLite 用 32 位无横线 hex 字符串；
还得自实现 `ValueBinder` 来正确处理 `null`（PG 的 uuid 列 `setNull` 要用 `Types.OTHER`）：

```java
public void bind(PreparedStatement st, X value, int index, WrapperOptions opt) {
  if (value == null)      st.setNull(index, isSqlite(opt) ? Types.VARCHAR : Types.OTHER);
  else if (isSqlite(opt)) st.setString(index, toHex(unwrap(value)));   // 32-hex
  else                    st.setObject(index, unwrap(value));          // 原生 uuid
}
```

### 规律

> **抽象层的厚度，与跨库适配的成本成正比。**

- Elysia / Gin 贴近 SQL，跨库 = 多写一份 SQL，简单直接、行数低；
- FastAPI / NestJS 在 ORM 的类型层加一个适配器（`TypeDecorator` / `ColumnOptions`），中等成本；
- Spring 的 JPA 抽象最厚、最“自动”，平时最省心，但要拗它跨库时，必须一路下沉到 Hibernate 的
  `JdbcType` / `ValueBinder` 这种底层 SPI——抽象帮你挡住的复杂度，在边界处会原样还回来。

（Spring 双驱动的这段经验，也记录在 `docs/dev-notes.md` 与项目记忆中。）

---

## 7. 鉴权实现

五者都实现了同一套 **JWT(HS256) + refresh token 轮换 + family 追踪**（`refresh_tokens` 表的 `family_id` / `revoked`）。差异只在库的选择：

| | JWT 库 | 密码哈希 | 备注 |
|---|---|---|---|
| FastAPI | PyJWT | bcrypt | 依赖注入 `Depends(get_current_user)` 解析 token |
| Spring | java-jwt (auth0) | spring-security-crypto | 未引入完整 Spring Security，仅用其 `BCryptPasswordEncoder` |
| Gin | golang-jwt/v5 | x/crypto bcrypt | 中间件 `middleware/auth.go` 解析 |
| NestJS | @nestjs/jwt + passport-jwt | bcrypt | Passport 策略 + `@UseGuards(JwtAuthGuard)` |
| Elysia | jose | bcryptjs | 函数式中间件 / `derive` 注入用户 |

值得一提：Spring **刻意只取 spring-security-crypto 的密码编码器**，没有引入完整的 Spring Security 过滤器链，
以保持与其他后端同构的、轻量的鉴权流程——这是“用框架的零件而非全家桶”的务实选择。

---

## 8. 并发与一致性

`favorite_count` 是 denormalized 字段（避免 plaza 排序时 JOIN），收藏 / 取消收藏时必须与 `favorites` 表一致地增减。各后端按本栈惯用法在事务里维护：

- **Spring** 最“正规”：`@Lock(PESSIMISTIC_WRITE)` 悲观锁 + `@Modifying` 的原子 `update … set favoriteCount = favoriteCount + 1`；
- **Elysia** 手写 `tx()`：PG 走 `BEGIN/COMMIT`、SQLite 走 `BEGIN IMMEDIATE`，在事务内更新；
- **Gin / NestJS / FastAPI** 各用 GORM / TypeORM / SQLAlchemy 的事务 API 包裹。

> 注：本项目定位为教学项目，生产级的高并发竞态（如多实例下计数漂移）不作为修复优先项；
> 这里关注的是“各栈如何表达事务与原子更新”，而非压测表现。

---

## 9. 依赖、构建与运行形态

| | 直接依赖 | 构建产物 | 启动 | 冷启动直觉 |
|---|---|---|---|---|
| Elysia | 5 | 无需构建（Bun 直跑 TS） | `bun src/main.ts` | 最快 |
| Gin | 8（+~35 间接） | **单一静态二进制** | `./server` | 极快、无运行时依赖 |
| FastAPI | 10 | 无（解释执行） | `uvicorn` | 快 |
| NestJS | 18 | `dist/`（tsc 编译） | `node dist/main` | 中 |
| Spring Boot | 11 | 胖 JAR | `java -jar` (JVM) | 最慢（JVM 预热） |

- **Elysia / Gin 在“轻”这件事上是两个极端代表**：Elysia 靠运行时（Bun）内置一切把依赖压到 5 个；
  Gin 靠编译期把一切打进一个静态二进制，部署时零运行时依赖。
- **NestJS 依赖最多（18）**，是企业框架“电池全包”的体现（DI、Passport、TypeORM、class-validator…）。
- **Spring 的胖 JAR + JVM** 启动最慢但运维生态最成熟，是大型团队的稳态选择。

---

## 10. LLM 集成

五个后端都各有一个独立的 LLM 客户端模块，给“胶囊主题建议 / 推荐”端点供能：

| 后端 | LLM 客户端 |
|---|---|
| FastAPI | `app/services/llm_client.py`（**参考实现**，其余对齐它） |
| Spring | `service/LlmClientService.java` |
| Gin | `internal/service/llm.go` |
| NestJS | `src/llm/`（独立模块 + suggestion/recommendation 两个 feature 模块） |
| Elysia | `src/llm.ts` |

所有实现都遵守 `CLAUDE.md` 规定的**结构化日志规范**：请求前 / 成功 / 失败三个时机各打一条
`LLM request|response|error` 日志，带 `model / elapsed_ms / tokens / status` 等字段，便于 `grep "LLM "` 统一排查。
（网关 SSL EOF 重试、CF 1010 改 UA 等坑见 `docs/dev-notes.md`。）

---

## 11. 入参校验与错误处理风格

同一份契约错误码，五种校验表达：

- **FastAPI / Pydantic**：类型即校验，`EmailStr` / 字段约束声明在 schema 上，框架自动 422。
- **NestJS / class-validator**：DTO 字段上挂 `@IsEmail()` 等装饰器 + 全局 `ValidationPipe`。
- **Spring / Bean Validation**：DTO 上 `@NotNull / @Size`，`@Valid` 触发，`@ControllerAdvice` 兜底。
- **Elysia / Zod**：路由上挂 schema，`zod` 解析失败即拒；最函数式。
- **Gin / validator + 手写**：struct tag `binding:"required"` + 大量手写校验分支——最显式、也最啰嗦。

声明式（Pydantic/Zod/装饰器）省代码但有“魔法”；Gin 的手写校验最透明但贡献了它领先的行数。

---

## 12. 横向总结与“该读哪一个”

| 你是… | 推荐先读 | 会学到 |
|---|---|---|
| 想要标准答案 | **FastAPI** | 参考实现，分层清晰、类型注解直观，所有其他栈都对齐它 |
| Java / 企业背景 | **Spring Boot** | 经典分层 + JPA；以及“重型 ORM 在边界处的代价” |
| 喜欢透明、无魔法 | **Gin** | 一切显式：错误处理、SQL 装配、依赖；代价是行数 |
| TS / 大型团队规范 | **NestJS** | DI + 模块化 + 装饰器，企业级 TS 的标准长相 |
| 追求极简 / 性能 | **Elysia** | 原生 SQL + 函数式 + 最少依赖，最“贴金属”的写法 |

**贯穿全文的一条主线**：功能完全相同的五个后端，代码量从 1 839 到 3 130 行不等，
差距不来自做了多少，而来自**语言的表达力**与**抽象的取舍**。原生 SQL 省行数但要自己兜底，
重型 ORM 省 CRUD 但在跨库边界会让你下沉到底层 SPI——
没有免费的抽象，只有把复杂度搬到了不同的地方。这正是这套多栈教学项目想让你亲手摸到的东西。

---

### 附：复现本文数据

```bash
# 代码量（以 gin 为例，其余替换路径/扩展名）
find backends/gin -name '*.go' ! -name '*_test.go' -not -path '*/vendor/*' -print0 | xargs -0 wc -l | tail -1

# 契约验证（双库）
./verification/scripts/verify-contract.sh <fastapi|spring|gin|nest|elysia>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <…>
```
