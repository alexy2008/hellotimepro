# HelloTime Pro · Ktor 后端

Kotlin + Ktor 实现的 HelloTime Pro 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
端口 **29090**（见根 `CLAUDE.md` 端口分配）。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | Kotlin 2.0 |
| 框架 | Ktor 2.3（Netty 引擎） |
| 序列化 | kotlinx.serialization（JSON） |
| 数据访问 | Exposed（类型安全 SQL DSL）+ HikariCP |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | java-jwt（HS256）+ bcrypt（at.favre） |
| 构建 | Gradle（Kotlin DSL，自带 wrapper） |

## 目录结构（分层）

```
src/main/kotlin/com/hellotimepro/ktor/
  Application.kt          ← main + 插件安装 + 路由注册（presentation）
  AppComponents.kt        ← 手动依赖装配（无 DI 容器）
  config/AppConfig.kt     ← 环境变量驱动的配置
  web/                    ← ApiException / AuthContext（鉴权边界）
  service/                ← 业务服务 + 手写校验 + LLM 客户端（application/domain）
  repository/             ← Exposed 仓库（infrastructure）
  db/                     ← 连接、表定义、跨库自定义列类型
  domain/Models.kt        ← 领域模型
  dto/Dtos.kt             ← 请求/响应 DTO（@Serializable）
```

## 安装与运行

需要 JDK 21（脚本会自动定位常见 JDK 21 安装位置）。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移）
./scripts/hello start ktor
./scripts/hello logs ktor

# 或直接在本目录
./build        # 编译 + 预热依赖缓存
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 单元冒烟（默认 SQLite，无需外部 PG）
```

> `run` 用 `./gradlew --no-daemon run`：让构建在 wrapper 进程内进行，fork 出的应用 JVM 与之同进程组，
> `hello stop` 的 `killpg` 才能连同清掉，避免守护进程 fork 导致端口泄漏。

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`DB_URL` 支持 `postgresql://user:pass@host:port/db` 与 `sqlite:///<path>`，在 `db/Database.kt` 解析为
HikariCP 配置。后端 **不** 创建/重置 schema、不迁移、不 seed。

## 实现特色

- **跨库列类型**（`db/CrossDbColumns.kt`）：在同一套 Exposed 表定义上按方言分流读写格式——
  SQLite 把 UUID 存成 32 位无横线 hex TEXT、时间戳存 ISO-8601 TEXT（与 seed 完全一致，保证字符串比较的
  `open_at <= now` / `ORDER BY created_at` 正确）；Postgres 用原生 `uuid` / `timestamptz` 直传。
  这是对 Spring `CrossDb*JdbcType` 的 Exposed 等价实现。
- **并发一致性**：Postgres 路径用 `SELECT ... FOR UPDATE` 行锁序列化收藏计数与 refresh token 轮转；
  SQLite 依赖单写事务（连接池大小为 1）。
- **refresh token 轮转 + 家族吊销**：重用检测分支先提交家族吊销再抛 401（事务内不抛异常、用 outcome 区分），
  等价 Spring 的 `noRollbackFor`。
- **手写字段校验**（`service/Validation.kt`）：Ktor 无 Bean Validation，按 `spec/openapi.yaml` 的正则/长度
  约束逐字段校验，统一抛 `VALIDATION_ERROR` → 422。
- **统一响应外壳**：`StatusPages` 把业务异常转为契约约定的 `{ success, data, message, errorCode }`。
- **LLM 客户端**：复用 JVM 原生 `java.net.http.HttpClient`，实现日志规范 / 网关重试 / CF-1010 UA 等坑的处理
  （见 `docs/dev-notes.md §3`）。未配置时建议端点本地兜底、推荐端点返回空列表。

## 验证

```bash
./verification/scripts/verify-contract.sh ktor              # PostgreSQL，104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh ktor   # SQLite，104/104
```

最新验收：2026-06-05，PostgreSQL & SQLite 各 **104/104**。

## 注意事项

- Gradle 默认输出目录 `build/` 与本目录的可执行脚本 `build` 冲突，已在 `build.gradle.kts` 改名为 `build-out/`。
- `hello start` 不注入 `PORT`，默认端口直接是登记端口 29090。
