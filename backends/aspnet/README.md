# HelloTime Pro · ASP.NET Core 后端

C# + ASP.NET Core + EF Core 实现的 HelloTime Pro 2.0.0 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
端口 **29050**（见根 `CLAUDE.md` 端口分配）。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | C# 12 |
| 框架 | ASP.NET Core 8（Kestrel + Controllers） |
| 序列化 | System.Text.Json（camelCase、原始 UTF-8） |
| 数据访问 | EF Core 8（LINQ + 变更跟踪）+ Npgsql / Microsoft.Data.Sqlite |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | System.IdentityModel.Tokens.Jwt（HS256）+ BCrypt.Net-Next |
| 构建 | dotnet SDK 8 |

## 目录结构（分层）

```
Program.cs                     ← 组装根：DI、provider 选择、Kestrel、中间件、静态资源（presentation）
src/Config/AppConfig.cs        ← 环境变量驱动的配置
src/Web/                       ← ApiException / 错误中间件 / AuthContext / 控制器基类（鉴权与响应边界）
src/Controllers/               ← 控制器（presentation）
src/Services/                  ← 业务服务 + 手写校验 + LLM 客户端（application/domain）
src/Repositories/              ← EF 仓库（infrastructure）
src/Infrastructure/            ← DbContext、跨库值转换器、DB_URL 解析
src/Domain/Entities.cs         ← 领域模型（兼 EF 实体）
src/Dto/Dtos.cs                ← 请求/响应 DTO + 统一响应外壳
tests/                         ← xUnit 单元与服务测试
```

## 安装与运行

需要 .NET SDK 8。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移）
./scripts/hello start aspnet
./scripts/hello logs aspnet

# 或直接在本目录
./build        # dotnet build -c Release（预构建，缩短冷启动）
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # xUnit 单元与服务测试（使用内存 SQLite，无需外部数据库）
```

> `run` 优先执行预构建的 `bin/Release` DLL；未构建时回退 `dotnet run -c Release`，仍落在契约就绪窗口内。

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`DB_URL` 支持 `postgresql[+driver]://user:pass@host:port/db` 与 `sqlite:///<path>`，在 `src/Infrastructure/DbUrl.cs`
解析为 EF provider 连接字符串。后端 **不** 创建/重置 schema、不迁移、不 seed。

## 实现特色

- **跨库值转换器**（`src/Infrastructure/CrossDb.cs` + `AppDbContext`）：在同一套 EF 实体上按 provider 分流存储格式——
  SQLite 把 UUID 存成 32 位无横线 hex TEXT、时间戳存 ISO-8601 TEXT（与 seed 完全一致：`T` 分隔、`+00:00`、
  零小数不输出，保证字符串比较的 `open_at <= now` / `ORDER BY created_at` 正确）；Postgres 走 Npgsql 原生
  `uuid` / `timestamptz`，不挂转换器。EF Core SQLite 默认把 DateTimeOffset 存成空格分隔 + 7 位小数的 TEXT，
  会破坏字符串比较，故必须接管。这是对 Ktor `CrossDbColumns` / Spring `CrossDb*JdbcType` 的 EF Core 等价实现。
- **并发一致性**：PostgreSQL 用 `SELECT ... FOR UPDATE`（`FromSqlRaw`）序列化 refresh token 轮转；
  收藏、取消收藏和删除统一先锁胶囊行，再操作收藏。SQLite 依赖单写事务。
- **统计**：广场列表与统计共用 LINQ 搜索谓词；个人统计包含未公开的胶囊，以及收到和给出的收藏。
- **refresh token 轮转 + 家族吊销**：重用检测分支先在事务内提交家族吊销，再到事务外抛 401（用 outcome 区分，
  不在事务内抛异常），等价 Spring 的 `noRollbackFor`。
- **手写字段校验**（`src/Services/Validation.cs`）：禁用 `[ApiController]` 自动 400，按 `spec/openapi.yaml`
  的正则/长度约束逐字段校验，统一抛 `VALIDATION_ERROR` → 422。
- **统一响应外壳**：`ErrorHandlingMiddleware` 把业务/反序列化/未捕获异常转为契约约定的 `{ success, data, message, errorCode }`。
- **LLM 客户端**：基于 `HttpClient`，实现日志规范 / 网关重试 / CF-1010 UA / chat 风格等坑（见 `docs/dev-notes.md §3`）。
  未配置时建议端点本地兜底、推荐端点返回空列表。

## 注意事项

- **JWT 密钥**：`Microsoft.IdentityModel` 强制 HS256 密钥 ≥256 位，而默认 `JWT_SECRET` 较短，故在
  `SecurityService` 用 SHA-256 把任意长度 secret 派生为 32 字节密钥（签发/校验同源，契约不跨后端验签）。
- **EF 插入排序**：`refresh_token`/`capsule`/`favorite` 必须在其引用的 `user`/`capsule` 之后插入。已在
  `AppDbContext` 用 `HasOne<>().WithMany().HasForeignKey(...)` 声明 FK 依赖，让 EF 正确排序级联插入
  （否则 register 同插 user+token 会触发 FK 失败）。
- `tests/` 在子目录，已用 `DefaultItemExcludes` 从主工程默认 glob 排除，避免被一并编译。
- `hello start` 不注入 `PORT` / `REPO_ROOT`：默认端口直接是登记端口 29050；`REPO_ROOT` 由 `run` 脚本导出绝对路径。
- 详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。

## 2.0 验证

2026-11-21 直接验证 `:29050`，未使用共享反代或默认数据库。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test`（xUnit 单元与服务测试） | 涉及数据库的用例使用内存 SQLite | 15/15 |
| 仓库契约 | 专用 PostgreSQL 库 `hellotime_contract_aspnet_*` | 117/117 |
| 同一仓库契约 | 临时 SQLite 文件 | 117/117 |

另验证 `./build` 通过，10 个头像 URL 的 SVG 均与 v2 规范一致。UI 冒烟、设计令牌检查不适用于纯后端。

## 2.0 迁移笔记

- 无 schema 迁移。EF Core 用 LINQ 常量分组聚合胶囊状态，空集合映射为零计数；最远和最近时刻直接排序投影 `open_at`，保留 SQLite 的时间值转换器，查不到则返回 `null`。
- 字面搜索用 `EF.Functions.Like` 的转义字符重载，先转义反斜杠、下划线和百分号，再拼接子串通配符；列表和统计共用相同条件。
- 删除胶囊先取 PostgreSQL 行锁，再用 `ExecuteDeleteAsync` 在同一事务中显式删除收藏。回归测试关闭了 SQLite 外键，确保删除不靠级联。头像目录和静态文件改读 `spec/avatars/v2/`，对外 URL 不变。
- PostgreSQL 复测须显式设置 `DB_DRIVER=postgres` 和专用 `DB_URL`，再执行 `./verification/scripts/verify-contract.sh aspnet`。SQLite 包装脚本的清理路径不一定采用 `DB_URL`，因此显式指定临时库并通过 `scripts/db` 初始化、`scripts/hello` 启停，直接用 `BASE_URL=http://127.0.0.1:29050 node --test verification/contract/*.spec.ts` 运行同一套用例。
