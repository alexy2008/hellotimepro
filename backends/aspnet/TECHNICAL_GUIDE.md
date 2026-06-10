# HelloTime Pro ASP.NET Core 后端技术手册与代码导读

本文面向已经熟悉 C# 基本语法（record/class、LINQ、async/await、nullable reference type、泛型），但还没系统接触过 ASP.NET Core、EF Core、中间件或依赖注入的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 ASP.NET Core 后端后，代码按什么顺序执行。
- ASP.NET Core Controllers、Middleware、DI、EF Core、System.Text.Json、JWT 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

## 1. 技术选型与设计特色

HelloTime Pro 的 ASP.NET Core 后端实现基于 **C# 12 + ASP.NET Core 8 + EF Core 8** 核心骨架，使用 Kestrel 作为 HTTP Server，Controllers 表达路由，System.Text.Json 负责 JSON，EF Core 负责数据访问，Npgsql / Microsoft.Data.Sqlite 负责双数据库驱动。数据库 schema 初始化、reset、seed 由仓库级 `scripts/db` 统一维护，ASP.NET 服务只连接已经准备好的数据库。

- **ASP.NET Core（中间件管线 + DI）**：`Program.cs` 显式组装服务、DbContext、中间件、静态资源和 Controllers，展示 .NET 现代最小宿主模型。
- **Controllers（清晰的 HTTP 边界）**：每个控制器负责一组 API，继承 `ApiControllerBase` 获得统一响应包装、鉴权 header 读取和 query 参数解析。
- **EF Core（LINQ + 变更跟踪）**：Repository 层用 EF Core 表达查询和事务，保留 C# 类型系统优势，同时不让 EF 创建/迁移 schema。
- **跨库 ValueConverter**：SQLite 的 UUID/时间戳格式由 `CrossDb` + `AppDbContext` 接管，避免 EF Core SQLite 默认格式破坏字符串排序。
- **手写校验与统一错误中间件**：禁用 `[ApiController]` 自动 400，按 OpenAPI 契约统一返回 422/业务错误码。

## 2. 先建立整体地图

核心目录：

```text
backends/aspnet/
├── Program.cs                         # 组装根：DI、DbContext、中间件、Controllers
├── HelloTimePro.Aspnet.csproj          # .NET SDK 项目文件
├── run / build / test                  # 运行、构建、测试脚本
├── src/
│   ├── Config/AppConfig.cs             # 环境变量配置
│   ├── Controllers/                    # HTTP 控制器
│   ├── Web/                            # 控制器基类、异常、中间件、AuthContext
│   ├── Services/                       # 业务逻辑、校验、LLM 客户端
│   ├── Repositories/                   # EF Core 查询封装
│   ├── Infrastructure/                 # DbContext、DB_URL 解析、跨库转换器
│   ├── Domain/Entities.cs              # 领域模型兼 EF 实体
│   └── Dto/Dtos.cs                     # 请求/响应 DTO 与统一 envelope
└── tests/                              # xUnit 纯逻辑测试
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Kestrel
  ▼
ErrorHandlingMiddleware
  ▼
Controller action
  │ AuthContext 解析用户
  │ Validation 手写校验
  ▼
Service
  │ 业务规则、事务、DTO 组装
  ▼
Repository
  │ EF Core / LINQ / FromSqlRaw
  ▼
PostgreSQL 或 SQLite
```

返回方向上，控制器用 `Wrapped(...)` 包统一成功响应；业务异常或 JSON 异常由 `ErrorHandlingMiddleware` 转为契约约定的错误外壳。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/aspnet
DB_DRIVER=sqlite ./run       # SQLite，零外部数据库依赖
../../scripts/db reset --seed # 显式准备 PostgreSQL 数据库
./run                        # 默认 PostgreSQL
```

也可以通过仓库级 dev manager：

```bash
./scripts/db reset --seed
./scripts/hello start aspnet
./scripts/hello logs aspnet
```

常用验证：

```bash
./build
./test
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh aspnet
../../verification/scripts/verify-contract.sh aspnet
```

`run` 优先执行 Release DLL；如果还没 build，则回退到 `dotnet run -c Release`。运行脚本不创建 schema、不迁移、不 seed。

## 4. 入口：`Program.cs`

`Program.cs` 是 ASP.NET Core 的组装根，主要做五件事：

1. 创建 `AppConfig`，从环境变量读取端口、数据库、JWT、LLM、repo root。
2. 注册 DI 服务：单例工具、scoped repository/service、DbContext。
3. 配置 JSON：camelCase，中文不转义。
4. 配置 EF Core provider：`DB_DRIVER=sqlite` 用 SQLite，否则用 Npgsql。
5. 构建中间件管线：错误中间件、静态资源、CORS、Controllers。

关键片段：

```csharp
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var cfg = sp.GetRequiredService<AppConfig>();
    var resolved = DbUrl.Resolve(cfg.DbDriver, cfg.DbUrl, cfg.RepoRoot);
    if (resolved.IsSqlite) options.UseSqlite(resolved.ConnectionString);
    else options.UseNpgsql(resolved.ConnectionString);
});
```

DbContext 是 scoped，和一次 HTTP 请求生命周期一致；repository/service 也注册为 scoped，避免跨请求共享数据库状态。

## 5. 中间件与控制器边界

`ErrorHandlingMiddleware` 放在管线最外层，负责把异常转换成统一错误响应：

- `ApiException`：按业务指定状态码和错误码返回。
- `JsonException` / bad body：返回 422 `VALIDATION_ERROR`。
- 未捕获异常：记录日志，返回 500 `INTERNAL_ERROR`。

控制器继承 `ApiControllerBase`：

- `Wrapped(data, status)`：统一成功响应。
- `AuthHeader`：读取 `Authorization`。
- `IntParam` / `Page` / `PageSize`：按契约解析 query 参数，非整数返回 422。

这个设计避免每个 action 重复写 envelope 和分页解析。

## 6. JSON 与 DTO

DTO 集中在 `src/Dto/Dtos.cs`：

- `Envelope<T>` / `ErrorEnvelope`：统一响应壳。
- `RegisterRequest`、`CreateCapsuleRequest` 等请求模型。
- `CapsuleDetail`、`CapsuleListItem`、`AuthTokens` 等响应模型。

项目没有依赖 DataAnnotations 自动校验，而是用 `Validation.cs` 手写规则。原因是 OpenAPI 契约要求统一 422 与自定义 `details`，而 ASP.NET Core 默认 `[ApiController]` 会在 ModelState 无效时自动返回 400。`Program.cs` 中显式关闭了这个自动行为。

## 7. 数据库层：EF Core 不做 DDL

`AppDbContext` 定义实体到表/列的映射：

- `users`
- `capsules`
- `favorites`
- `refresh_tokens`

它不调用 `Database.Migrate()`，也没有 EF migration。schema 由根目录 `scripts/db` 维护，EF 这里只负责查询和保存。

Repository 层封装常见查询：

- `UserRepository`
- `CapsuleRepository`
- `FavoriteRepository`
- `RefreshTokenRepository`

Service 层不直接写复杂 LINQ，而是通过 repository 表达意图；遇到并发锁等 provider 特性时，repository/service 会用 `FromSqlRaw` 或事务显式处理。

## 8. 跨库 ValueConverter

`CrossDb.cs` 是 ASP.NET 实现最值得读的基础设施文件之一。问题背景：

- PostgreSQL 支持原生 `uuid` / `timestamptz`。
- SQLite schema 中 UUID 是 32 位无横线 hex TEXT，时间戳是 ISO-8601 TEXT。
- EF Core SQLite 默认把 `DateTimeOffset` 存成空格分隔、固定小数位的字符串，会破坏 `open_at <= now` 和 `ORDER BY created_at` 的字符串比较。

解决方式：

- `CrossDb.FormatGuid(Guid)`：写成 32 位小写 hex。
- `CrossDb.FormatTimestamp(DateTimeOffset)`：写成 UTC、`T` 分隔、`+00:00`、零小数不输出。
- `AppDbContext.ApplySqliteConverters()`：仅 SQLite provider 下给 Guid/DateTimeOffset 属性挂转换器。

PostgreSQL 路径不挂转换器，交给 Npgsql 原生映射。

## 9. Service 层与事务

核心 service：

- `AuthService`：注册、登录、refresh token 轮转、改密吊销。
- `UserService`：资料更新。
- `CapsuleService`：创建、查询、删除自己的胶囊。
- `PlazaService`：广场列表、详情、我的胶囊/收藏。
- `FavoriteService`：收藏/取消收藏。
- `CapsuleSuggestionService` / `CapsuleRecommendationService`：AI 辅助接口。

`FavoriteService` 维护 `favorite_count`：

- favorites 行变化和 capsule 计数更新必须同处一个事务。
- PostgreSQL 路径用 `SELECT ... FOR UPDATE` 锁住胶囊行。
- SQLite 依赖单写事务。
- 重复收藏/取消保持幂等。

refresh token 轮转也使用事务；重放 revoked token 时，先提交 family 吊销，再在事务外返回 401，避免异常回滚掉吊销结果。

## 10. 鉴权与安全

`SecurityService` 负责底层安全能力：

- BCrypt 密码哈希。
- JWT access token 签发/校验。
- refresh token 随机生成与哈希。

`AuthContext` 是 Web 边界：

- `Required(...)`：需要登录的接口调用，失败抛 `UNAUTHORIZED`。
- `Optional(...)`：广场列表/胶囊详情允许匿名访问时使用。

一个 .NET 特有点：`Microsoft.IdentityModel` 要求 HS256 密钥至少 256 位。默认开发 `JWT_SECRET` 可能较短，所以 `SecurityService` 用 SHA-256 派生出 32 字节签名密钥，保证签发和校验同源。

## 11. 校验与错误处理

`Validation.cs` 集中表达契约规则：

- 注册邮箱、密码强度、昵称、头像 id。
- 胶囊标题/正文长度。
- `openAt` 必须晚于当前时间 60 秒，且不超过 10 年。
- 更新资料至少提供一个字段。
- 推荐 count 必须在 3 到 8 之间。

校验失败抛 `ApiException.Validation(...)`，最终由中间件返回 422。这样 ASP.NET、Ktor、Gin 等手写校验栈可以和 Pydantic/class-validator/Bean Validation 栈对齐同一个错误壳。

## 12. LLM 客户端

`LlmClient.cs` 对齐 FastAPI 参考实现：

- 未启用或未配置 key 时，建议接口本地兜底，推荐接口返回空列表。
- 请求前打 `LLM request  model=... url=...`。
- 成功打 `LLM response model=... elapsed_ms=... tokens=...`。
- 失败打 `LLM error    model=... elapsed_ms=... status=...` 或 `error=...`。
- 支持 Responses API，也兼容部分 chat 风格网关。

提示词来自 `spec/llm/*.prompt.md`，service 层负责填变量、裁剪长度和处理本地 fallback。

## 13. 测试与契约验证

本后端的 xUnit 测试集中验证纯逻辑不变式，尤其是 SQLite UUID/时间戳格式：

```bash
./test
```

行为验收依赖仓库级黑盒契约：

```bash
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh aspnet
../../verification/scripts/verify-contract.sh aspnet
```

黑盒契约从 HTTP 外部验证，不读取 EF Core 或 service 内部实现。

## 14. 常见改动应该改哪里

新增接口：

1. 先改 `spec/api/openapi.yaml`。
2. 在 `Dto/Dtos.cs` 增加请求/响应 DTO。
3. 在 `Services/` 增加业务函数。
4. 如需数据库访问，在 `Repositories/` 增加查询。
5. 在 `Controllers/` 增加 action。
6. 使用 `Wrapped(...)` 返回成功响应，不手写 envelope。
7. 补黑盒契约或相应验证。

新增字段：

1. 先改 `spec/api` / `spec/db`。
2. 更新仓库级数据库维护脚本。
3. 更新 `Domain/Entities.cs`。
4. 更新 `AppDbContext.OnModelCreating` 的列映射；SQLite 下必要时加 converter。
5. 更新 repository 查询、DTO、`MapperService`。
6. PostgreSQL 与 SQLite 契约都要跑。

修改跨库存储格式：

1. 先读 `CrossDb.cs` 和 `AppDbContext.ApplySqliteConverters()`。
2. 确认 seed、SQLite 字符串比较、Postgres 原生类型三者一致。
3. 补 xUnit 测试固定格式，再跑契约验证。

## 15. 读代码的路线

第一次读 ASP.NET Core 后端，建议按这个顺序：

1. `Program.cs`：看 DI、DbContext、中间件、静态资源和 Controllers 如何装配。
2. `src/Web/ErrorHandlingMiddleware.cs` 和 `ApiControllerBase.cs`：看统一响应和错误边界。
3. `src/Dto/Dtos.cs`：看 API 数据形状。
4. `src/Services/Validation.cs`：看契约校验规则。
5. `src/Services/AuthService.cs`、`CapsuleService.cs`、`FavoriteService.cs`：看核心业务。
6. `src/Repositories/*`：看 EF Core 查询。
7. `src/Infrastructure/AppDbContext.cs` 和 `CrossDb.cs`：最后看跨库映射细节。

这样读会先理解 ASP.NET Core 的请求管线，再进入 EF Core 和跨库存储的实现细节。
