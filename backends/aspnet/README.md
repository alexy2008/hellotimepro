# HelloTime Pro · ASP.NET Core 后端

C# + ASP.NET Core + EF Core 实现的 HelloTime Pro 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
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
tests/                         ← xUnit 单元测试（固定跨库格式不变式）
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
./test         # xUnit 单元测试（纯逻辑，无需外部数据库）
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
- **并发一致性**：Postgres 路径用 `SELECT ... FOR UPDATE`（`FromSqlRaw`）序列化收藏计数与 refresh token 轮转；
  SQLite 依赖单写事务。收藏计数与 favorites 行变更同处一个事务。
- **refresh token 轮转 + 家族吊销**：重用检测分支先在事务内提交家族吊销，再到事务外抛 401（用 outcome 区分，
  不在事务内抛异常），等价 Spring 的 `noRollbackFor`。
- **手写字段校验**（`src/Services/Validation.cs`）：禁用 `[ApiController]` 自动 400，按 `spec/openapi.yaml`
  的正则/长度约束逐字段校验，统一抛 `VALIDATION_ERROR` → 422。
- **统一响应外壳**：`ErrorHandlingMiddleware` 把业务/反序列化/未捕获异常转为契约约定的 `{ success, data, message, errorCode }`。
- **LLM 客户端**：基于 `HttpClient`，实现日志规范 / 网关重试 / CF-1010 UA / chat 风格等坑（见 `docs/dev-notes.md §3`）。
  未配置时建议端点本地兜底、推荐端点返回空列表。

## 验证

```bash
./verification/scripts/verify-contract.sh aspnet              # PostgreSQL，104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh aspnet   # SQLite，104/104
```

最新验收：2026-06-06，PostgreSQL & SQLite 各 **104/104**。

## 注意事项

- **JWT 密钥**：`Microsoft.IdentityModel` 强制 HS256 密钥 ≥256 位，而默认 `JWT_SECRET` 较短，故在
  `SecurityService` 用 SHA-256 把任意长度 secret 派生为 32 字节密钥（签发/校验同源，契约不跨后端验签）。
- **EF 插入排序**：`refresh_token`/`capsule`/`favorite` 必须在其引用的 `user`/`capsule` 之后插入。已在
  `AppDbContext` 用 `HasOne<>().WithMany().HasForeignKey(...)` 声明 FK 依赖，让 EF 正确排序级联插入
  （否则 register 同插 user+token 会触发 FK 失败）。
- `tests/` 在子目录，已用 `DefaultItemExcludes` 从主工程默认 glob 排除，避免被一并编译。
- `hello start` 不注入 `PORT` / `REPO_ROOT`：默认端口直接是登记端口 29050；`REPO_ROOT` 由 `run` 脚本导出绝对路径。
- 详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。
