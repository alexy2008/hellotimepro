# HelloTime Pro · Spring Boot 后端

Java 21 + Spring Boot 3 + Spring Data JPA 实现的 HelloTime Pro 2.0.0 后端，支持 PostgreSQL / SQLite 双驱动；保留 Flyway 迁移文件作为本栈 schema 表达样例。服务端口 **29000**，管理器登记名为 `spring`。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | Java 21 |
| 框架 | Spring Boot 3（Spring Web MVC + 嵌入式 Tomcat） |
| 数据访问 | Spring Data JPA（Hibernate ORM） |
| schema | 由仓库级 `scripts/db` 维护；`db/migration` 下保留 Flyway SQL 作为本栈表达样例 |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | java-jwt（auth0，HS256）+ spring-security-crypto（BCrypt） |
| 入参校验 | Bean Validation + 业务层手写校验 |
| 构建 | Maven → 胖 JAR（JVM） |

## 目录结构（经典分层 MVC）

```
HelloTimeProApplication.java   ← 入口（main + 自动装配）
config/AppProperties.java      ← @ConfigurationProperties 环境变量绑定
web/                           ← 控制器 + ApiException + GlobalExceptionHandler（presentation）
service/                       ← 业务服务 + LLM 客户端（application/domain）
repository/                    ← Spring Data JPA Repository（infrastructure）
domain/*Entity.java            ← JPA 实体（domain）
db/CrossDb*JdbcType.java       ← 跨库 UUID / 时间戳 JdbcType（infrastructure）
dto/Dtos.java                  ← 请求/响应 DTO + 统一响应外壳
src/main/resources/            ← application.yml、Flyway 参考迁移
```

`controller → service → repository → entity` 与项目要求的 `presentation → application → domain → infrastructure` 四层映射最贴合，是 JVM 系读者的首选样板。

## 安装与运行

需要 JDK 21。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移/seed）
./scripts/hello start spring
./scripts/hello logs spring

# 或直接在本目录
./build        # Maven 打包（预构建，缩短冷启动）
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 切片/集成测试（SQLite，纯逻辑无需外部数据库）
```

常用命令：

| 场景 | 命令 |
|---|---|
| 开发运行 | `./run` |
| SQLite 测试 | `./test` |
| 编译打包 | `./build` |
| 指定端口 | `PORT=29001 ./run` |
| 准备数据库 | `../../scripts/db reset --seed` |

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

后端 **不** 创建/重置 schema、不跑 Flyway 迁移、不 seed——`db/migration` 下的 SQL 仅作为"本栈如何表达 schema"的样例保留。

## 实现特色

- **跨库 `@JdbcType` 分流**（`db/CrossDbUuidJdbcType.java` + `CrossDbOffsetDateTimeJdbcType.java`）：在同一套 JPA 实体上按
  Hibernate 方言分流读写格式——SQLite 把 UUID 存 32 位无横线 hex TEXT、时间戳存 ISO-8601 TEXT（与 seed 完全一致：`T` 分隔、
  `+00:00`、零小数不输出，保证字符串比较的 `open_at <= :now` / `ORDER BY created_at` 正确）；Postgres 走原生 `uuid` / `timestamptz`。
  两个 JdbcType 都**自实现了 `ValueBinder`**：连 null 也要按方言给出正确的 `setNull` 类型（SQLite→`VARCHAR`、PG→`TIMESTAMP_WITH_TIMEZONE`），
  否则 Postgres 会把 VARCHAR null 写进 timestamptz 列而报类型错误。这是 Spring/Hibernate 版对 Ktor `CrossDbColumns` /
  ASP.NET `CrossDb` ValueConverter 的等价实现。
- **声明式事务 `@Transactional`**：服务方法直接享受 Spring 的事务边界。refresh token 轮转用
  `@Transactional(noRollbackFor = ApiException.class)`——重放检测命中时先提交同 family 的吊销、再抛 401，靠 `noRollbackFor`
  保证"要提交的失败"不被回滚。**其余手写事务的后端（Ktor/ASP.NET/Vapor/Axum/Drogon）用 outcome 枚举模拟的，正是这一行声明式语义。**
- **行锁并发一致性**：Postgres 路径对 `refresh_tokens` 用 `SELECT ... FOR UPDATE`（`findByTokenHashForUpdate`）线性化轮转，
  收藏、取消收藏和作者删除统一先锁胶囊行；计数与收藏变更同事务，删除时先显式清理收藏。SQLite 使用单写事务。
- **统一错误外壳**：`GlobalExceptionHandler`（`@RestControllerAdvice`）把业务 `ApiException`、Bean Validation 失败、
  反序列化错误统一转为契约约定的 `{ success, data, message, errorCode }`，业务层不感知 HTTP 细节。
- **LLM 客户端**（`LlmClientService`）：实现日志规范 / 网关重试 / CF-1010 UA / chat 风格等坑（见 `docs/dev-notes.md`）。
  未配置时建议端点本地兜底、推荐端点返回空列表。
- 静态头像和技术栈图标直接读取 `spec/avatars/v2/`、`spec/icons/`，对外 URL 不变。

本实现对齐 `spec/api/openapi.yaml` 与 `spec/db/schema.sql`。详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。

## 2.0 验证

2026-11-21 直接验证 `:29000`，未使用共享反代或默认数据库。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test`（单元与本栈冒烟） | 临时 SQLite | 5/5 |
| 仓库契约 | 专用 PostgreSQL 库 `hellotime_contract_spring_*` | 117/117 |
| 同一仓库契约 | 临时 SQLite 文件 | 117/117 |

另验证 `./build` 通过，10 个头像 URL 的 SVG 均与 v2 规范一致。UI 冒烟、设计令牌检查不适用于纯后端。

评审修正后复验（2026-11-21，路径 UUID 校验，见迁移笔记最后一条）：

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test`（新增路径 UUID 用例） | 临时 SQLite | 6/6 |
| 仓库契约 | 专用 PostgreSQL 库 | 117/117 |
| 同一仓库契约 | 临时 SQLite 文件 | 117/117 |

## 2.0 迁移笔记

- 无 schema 迁移。广场列表与统计复用 JPQL 谓词；时间极值使用 Spring Data 单列投影和 `findFirst…OrderBy…`，保留 Hibernate 自定义 JDBC 时间类型映射，且不受搜索词影响。
- PostgreSQL 继续用 `PESSIMISTIC_WRITE`；收藏、取消收藏、删除按同一顺序操作。SQLite 使用单连接池及 `transaction_mode=IMMEDIATE`，避免读事务升级为写事务时遇到锁冲突。删除时用 JPQL 批量删除收藏，不依赖外键级联。
- PostgreSQL 复测须显式设置 `DB_DRIVER=postgres` 和专用 `DB_URL`，再执行 `./verification/scripts/verify-contract.sh spring`。SQLite 包装脚本的清理路径不一定采用 `DB_URL`，因此显式指定临时库并通过 `scripts/db` 初始化、`scripts/hello` 启停，直接用 `BASE_URL=http://127.0.0.1:29000 node --test verification/contract/*.spec.ts` 运行同一套用例。
- 路径里的胶囊 id 统一经 `CapsuleIds.parse` 校验（与请求体 `@Pattern` 共用 `Dtos.UUID_PATTERN`），格式不合法返回 422。此前 `GET /plaza/capsules/{id}`、`DELETE /me/capsules/{id}` 直接 `UUID.fromString`，非法值落到通用处理器变成 500；`DELETE /me/favorites/{id}` 吞掉异常返回 204。`UUID.fromString` 还会接受 `1-1-1-1-1` 这类非标准写法，所以先用正则判格式。
