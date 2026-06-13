# HelloTime Pro ASP.NET Core 后端技术手册与代码导读

本文面向已经熟悉 C# 基本语法（record/class、LINQ、async/await、nullable reference type、泛型），但还没系统接触过 ASP.NET Core、EF Core、中间件或依赖注入的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 ASP.NET Core 后端后，代码按什么顺序执行。
- ASP.NET Core Controllers、Middleware、DI（含 singleton/scoped 生命周期）、EF Core、System.Text.Json、JWT 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：§1～§4 建立选型、地图、入口认识；**§5 是钥匙**——讲清 ASP.NET Core 的几个核心机制
> （最小宿主组装、DI 生命周期、中间件管线、控制器基类、EF 变更跟踪）；§6～§11 按请求生命周期分层；
> 其中 **§8 跨库 ValueConverter** 是这个实现最值得读的基础设施；§14 用一次注册请求把全链路串起来。

---

## 1. 技术选型与设计特色

HelloTime Pro 的 ASP.NET Core 后端实现基于 **C# 12 + ASP.NET Core 8 + EF Core 8** 核心骨架，使用 Kestrel 作为 HTTP Server，Controllers 表达路由，System.Text.Json 负责 JSON，EF Core 负责数据访问，Npgsql / Microsoft.Data.Sqlite 负责双数据库驱动。数据库 schema 初始化、reset、seed 由仓库级 `scripts/db` 统一维护，ASP.NET 服务只连接已经准备好的数据库。端口 **29050**（见根 `CLAUDE.md` 端口分配）。

- **ASP.NET Core（中间件管线 + DI）**：`Program.cs` 显式组装服务、DbContext、中间件、静态资源和 Controllers，展示 .NET 现代最小宿主模型。
- **Controllers（清晰的 HTTP 边界）**：每个控制器负责一组 API，继承 `ApiControllerBase` 获得统一响应包装、鉴权 header 读取和 query 参数解析。
- **EF Core（LINQ + 变更跟踪）**：Repository 层用 EF Core 表达查询和事务，保留 C# 类型系统优势，同时不让 EF 创建/迁移 schema。
- **跨库 ValueConverter**：SQLite 的 UUID/时间戳格式由 `CrossDb` + `AppDbContext` 接管，避免 EF Core SQLite 默认格式破坏字符串排序。
- **手写校验与统一错误中间件**：禁用 `[ApiController]` 自动 400，按 OpenAPI 契约统一返回 422/业务错误码。

## 2. 先建立整体地图

ASP.NET 后端的职责：提供 `/api/v1/*` HTTP API、校验请求、处理注册/登录/JWT/refresh 轮转、读写用户/胶囊/收藏并维护 `favorite_count`、在 PostgreSQL 与 SQLite 间无缝切换、暴露 `spec/` 静态资源、提供 LLM 建议/推荐接口。

核心目录：

```text
backends/aspnet/
├── Program.cs                         # 组装根：DI、provider 选择、Kestrel、中间件、静态资源（presentation）
├── HelloTimePro.Aspnet.csproj
├── run / build / test
├── src/
│   ├── Config/AppConfig.cs            # 环境变量驱动的配置
│   ├── Web/                           # ApiException / 错误中间件 / AuthContext / 控制器基类
│   ├── Controllers/                   # 控制器（presentation）：Auth / Me / Capsules / Plaza / Ai / Health / Avatars
│   ├── Services/                      # 业务服务 + 手写校验 + LLM 客户端（application/domain）
│   ├── Repositories/                  # EF 仓库（infrastructure）
│   ├── Infrastructure/                # DbContext、跨库值转换器（CrossDb）、DB_URL 解析
│   ├── Domain/Entities.cs             # 领域模型（兼 EF 实体）
│   └── Dto/Dtos.cs                    # 请求/响应 DTO + 统一响应外壳
└── tests/                            # xUnit 单元测试（固定跨库格式不变式）
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Kestrel
  ▼
ErrorHandlingMiddleware（最外层，统一错误外壳）
  ▼
Controller action（继承 ApiControllerBase）
  │ AuthContext.Required/Optional 解析用户
  │ Validation 手写校验
  ▼
Service（scoped，与请求生命周期一致）
  │ 业务规则、事务、DTO 组装
  ▼
Repository（EF Core / LINQ / FromSqlRaw）
  ▼
PostgreSQL 或 SQLite
```

返回方向：控制器用 `Wrapped(...)` 包统一成功响应；业务异常或 JSON 异常由 `ErrorHandlingMiddleware` 转为契约约定的错误外壳。

## 3. 如何运行和验证

```bash
cd backends/aspnet
DB_DRIVER=sqlite ./run        # SQLite，零外部依赖
../../scripts/db reset --seed # 显式准备 PostgreSQL 数据库
./run                         # 默认 PostgreSQL
./build                       # dotnet build -c Release（预构建，缩短冷启动）
./test                        # xUnit 单元测试（纯逻辑）
../../verification/scripts/verify-contract.sh aspnet          # 契约 104 用例（PG）
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh aspnet
```

`run` 优先执行预构建的 `bin/Release` DLL；未构建时回退 `dotnet run -c Release`。运行脚本不创建 schema、不迁移、不 seed。

## 4. 入口：`Program.cs`

`Program.cs` 是 ASP.NET Core 的组装根（最小宿主模型），主要做五件事：

```csharp
var builder = WebApplication.CreateBuilder(args);
var config = new AppConfig();
builder.WebHost.UseUrls($"http://{config.Host}:{config.Port}");

// ① 单例：无 per-request 状态 / 启动时一次性加载
builder.Services.AddSingleton<SecurityService>();
builder.Services.AddSingleton<AvatarService>();
builder.Services.AddSingleton<LoginRateLimiter>();   // 进程内限流，必须单例

// ② DbContext：按 DB_DRIVER 选 provider（scoped，与请求生命周期一致）
builder.Services.AddDbContext<AppDbContext>((sp, options) => {
    var resolved = DbUrl.Resolve(cfg.DbDriver, cfg.DbUrl, cfg.RepoRoot);
    if (resolved.IsSqlite) options.UseSqlite(...); else options.UseNpgsql(...);
});

// ③ 仓库 / 服务 / 鉴权上下文：scoped，随请求与 DbContext 一致
builder.Services.AddScoped<AuthService>();  /* ...UserService/CapsuleService/... */

// ④ 关键：禁用 [ApiController] 的自动 400 ModelState 校验（自己转契约外壳）
builder.Services.Configure<ApiBehaviorOptions>(o => o.SuppressModelStateInvalidFilter = true);

var app = builder.Build();
app.UseMiddleware<ErrorHandlingMiddleware>();   // ⑤ 错误中间件最外层
app.UseStaticFiles(...); app.UseCors(); app.MapControllers();
app.Run();
```

## 5. ASP.NET Core 的几个关键思想

看懂下面几件事，全篇剩下的都是常规 C#。

### 5.1 最小宿主 + DI 生命周期：singleton vs scoped

`Program.cs` 同时是"服务注册中心"和"中间件管线声明"。注册时的**生命周期**很关键：

- **`AddSingleton`**：全进程一个实例。用于无 per-request 状态、或必须跨请求共享的服务——`SecurityService`（无状态）、
  `AvatarService`（启动加载一次）、**`LoginRateLimiter`（进程内限流计数，做成 scoped 就丢了）**。
- **`AddScoped`**：每个 HTTP 请求一个实例，请求结束释放。`AppDbContext` 与所有用它的仓库/服务都 scoped——
  这样一次请求里它们共享**同一个 DbContext**（同一个工作单元、同一条连接），请求之间互不串状态。

把限流器错放成 scoped、或把 DbContext 错放成 singleton 都会出 bug，这是 .NET DI 最常见的坑。

### 5.2 中间件管线：洋葱模型

`app.UseXxx(...)` 按顺序构成一个洋葱：请求自外向内穿过，响应自内向外穿回。`ErrorHandlingMiddleware`
放在**最外层**，所以它能 try/catch 住内层（Controller、Service）抛出的任何异常，转成契约错误外壳（§11）。

### 5.3 控制器薄、基类兜底

控制器只做"取参 → 调 service → `Wrapped` 包壳"，公共能力上提到 `ApiControllerBase`：

```csharp
[Route("api/v1/auth")]
public sealed class AuthController : ApiControllerBase {
    private readonly AuthService _auth;
    public AuthController(AuthService auth) => _auth = auth;   // 构造函数注入（DI 容器填充）

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest? req) {
        var tokens = await _auth.Register(req ?? new RegisterRequest(null, null, null, null));
        return Wrapped(tokens, StatusCodes.Status201Created);
    }
}
```

`ApiControllerBase` 提供 `Wrapped<T>(data, status)`（统一成功外壳）、`AuthHeader`、`IntParam/Page/PageSize`
（缺失用默认值、**存在但非整数 → 422**，对齐 openapi）。`[FromBody] ... ?` 用可空 + `?? new(...)`，
把"空请求体"交给手写校验裁决成 422，而不是框架自动 400。

### 5.4 EF Core 变更跟踪：改对象就是改库

EF Core 跟踪从 DbContext 取出的实体，`SaveChangesAsync()` 时把"被改过的字段"生成 UPDATE。
所以收藏计数可以写成 `capsule.FavoriteCount += 1; await _db.SaveChangesAsync();`——前提是这行在事务 + 行锁
保护下（§9）。这与 axum/gin 的"原子 SQL 表达式 `favorite_count + 1`"是两种风格：EF 走"读-改-写 + 锁"，
裸 SQL 走"原子表达式"，都能保证并发正确，前者更 OO、后者更省一次读。

## 6. JSON 与 DTO

DTO 集中在 `src/Dto/Dtos.cs`：`Envelope<T>` / `ErrorEnvelope`（统一响应壳）、各请求/响应 record。
JSON 配置 camelCase + `UnsafeRelaxedJsonEscaping`（中文不转义成 `\uXXXX`），MVC 与错误中间件**共用同一套 `JsonSerializerOptions`**。

项目没有依赖 DataAnnotations 自动校验，而是用 `Validation.cs` 手写规则。原因是 OpenAPI 契约要求统一 422 与自定义 `details`，而 ASP.NET Core 默认 `[ApiController]` 会在 ModelState 无效时自动返回 400——`Program.cs` 用 `SuppressModelStateInvalidFilter = true` 显式关掉了它。

## 7. 数据库层：EF Core 不做 DDL

`AppDbContext` 定义 `users` / `capsules` / `favorites` / `refresh_tokens` 四个实体到表/列的映射（`OnModelCreating` 里逐字段 `HasColumnName`）。它 **不调用 `Database.Migrate()`、没有 EF migration**——schema 由 `scripts/db` 维护，EF 只负责查询和保存。

Repository 层封装常见查询（`UserRepository` / `CapsuleRepository` / `FavoriteRepository` / `RefreshTokenRepository`）；
遇到行锁等 provider 特性时用 `FromSqlRaw` 或事务显式处理（如 `FindByIdForUpdate` 在 PG 上拼 `FOR UPDATE`）。

## 8. 跨库 ValueConverter

`CrossDb.cs` 是 ASP.NET 实现最值得读的基础设施文件。问题背景：

- PostgreSQL 支持原生 `uuid` / `timestamptz`，由 Npgsql 直接映射 Guid / DateTimeOffset。
- SQLite schema 中 UUID 是 32 位无横线 hex TEXT，时间戳是 ISO-8601 TEXT。
- **EF Core SQLite 默认把 `DateTimeOffset` 存成空格分隔 + 7 位小数的 TEXT**，会破坏 `open_at <= now` 和
  `ORDER BY created_at` 的字符串比较，故必须接管格式。

解决方式：仅 SQLite provider 下给 Guid / DateTimeOffset 属性挂 `ValueConverter`：

```csharp
public static string FormatTimestamp(DateTimeOffset value) {
    var u = value.ToUniversalTime();
    var s = u.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
    long frac = u.Ticks % TimeSpan.TicksPerSecond;          // 100ns 单位
    if (frac != 0) s += "." + frac.ToString("D7").TrimEnd('0');  // 零小数不输出
    return s + "+00:00";                                    // 与 seed 对齐：+00:00 而非 Z
}
public static readonly ValueConverter<Guid, string> GuidToHex = new(g => g.ToString("N"), s => ParseGuid(s));
public static readonly ValueConverter<DateTimeOffset, string> TimestampToIso = new(d => FormatTimestamp(d), s => ParseTimestamp(s));
```

`AppDbContext.ApplySqliteConverters()` 在 SQLite 下把这些转换器挂到每个 Guid/时间戳属性（含可空的
`revoked_at` 用 `NullableTimestampToIso`）；PostgreSQL 路径不挂，交给 Npgsql 原生映射。这是对 Ktor `CrossDbColumns` /
Spring `CrossDb*JdbcType` 的 EF Core 等价实现。

## 9. Service 层与事务

核心 service：`AuthService` / `UserService` / `CapsuleService` / `PlazaService` / `FavoriteService` +
两个 AI service。`FavoriteService` 维护 `favorite_count`：

```csharp
await using var tx = await _db.Database.BeginTransactionAsync();
var capsule = await _capsules.FindByIdForUpdate(capsuleId) ?? throw ApiException.NotFound("胶囊不存在");  // PG: FOR UPDATE 行锁
// ... 幂等检查 ...
capsule.FavoriteCount += 1;            // EF 变更跟踪（§5.4），行锁保护下的读-改-写
await _db.SaveChangesAsync();
await tx.CommitAsync();
```

- favorites 行变化和 capsule 计数更新同处一个事务；PG 用 `SELECT ... FOR UPDATE` 锁住胶囊行，SQLite 依赖单写事务。
- 重复收藏/取消保持幂等（已收藏直接 commit 返回原状态）。

**refresh token 轮转**（`AuthService.Refresh`）：重放 revoked token 时，必须先提交 family 吊销、再在事务外返回 401，
避免异常回滚掉吊销结果。实现用 `Outcome { Success, Invalid, Reused }` 枚举：事务内只设 outcome、`CommitAsync()`，
出事务后 `switch` 转 401——等价 Ktor/Spring 的 `noRollbackFor` 语义。

## 10. 鉴权与安全

`SecurityService`（单例，无可变状态）负责 BCrypt 密码哈希、JWT 签发/校验、refresh token 生成与哈希。
`AuthContext`（scoped，Web 边界）`Required(...)` 失败抛 401、`Optional(...)` 匿名返回 null。

两个 .NET 特有点（都在 `SecurityService` 构造函数里）：

```csharp
// ① Microsoft.IdentityModel 强制 HS256 密钥 ≥256 位；用 SHA-256 把任意长度 secret 派生为 32 字节密钥
_key = new SymmetricSecurityKey(SHA256.HashData(Encoding.UTF8.GetBytes(config.JwtSecret)));
_validation = new TokenValidationParameters {
    ValidateLifetime = true, IssuerSigningKey = _key,
    ClockSkew = TimeSpan.Zero,   // ② 关掉默认 5 分钟过期宽限——契约的"过期即失效"用例需要精确边界
};
```

校验时区分异常：`SecurityTokenExpiredException` → `access_token_expired`，其它 → `invalid_token`（契约对 401 message 有约定）。

## 11. 校验与错误处理

`Validation.cs` 集中表达契约规则（邮箱/密码强度/昵称/头像 id、标题/正文长度、`openAt` 晚于当前 60 秒且不超 10 年、
更新资料至少一个字段、推荐 count 在 3-8）。失败抛 `ApiException.Validation(...)`，最终由中间件返回 422。

`ErrorHandlingMiddleware`（管线最外层，§5.2）按异常类型分流：

```csharp
try { await _next(ctx); }
catch (ApiException ex)        { await Write(ctx, (int)ex.Status, new ErrorEnvelope(ex.Message, ex.Code.ToString()){ Details = ex.Details }); }
catch (Exception ex) when (ex is JsonException || ex is BadHttpRequestException) {
    await Write(ctx, 422, /* VALIDATION_ERROR + details:[("body","请求体格式不合法")] */); }   // 坏 JSON / 类型不符
catch (Exception ex)           { _log.LogError(ex,...); await Write(ctx, 500, /* INTERNAL_ERROR */); }
```

`Write` 先检查 `Response.HasStarted` 再 `Clear()`——避免响应已开始时写半截 JSON。

## 12. LLM 客户端

`LlmClient.cs`（基于 `HttpClient`）对齐 FastAPI 参考实现：日志规范（`LLM request/response/error` 三时机 + 必含字段）、
网关瞬时错误重试、CF-1010 改 Chrome UA、chat 风格 + `thinking` 关闭、`responses`/`auto` 可切。
提示词来自 `spec/llm/*.prompt.md`；未配置时建议端点本地兜底、推荐端点返回空列表。

## 13. 一个 .NET 特有坑：EF 插入排序

`refresh_token` / `capsule` / `favorite` 必须在其引用的 `user` / `capsule` 之后插入。`AppDbContext` 用
`HasOne<User>().WithMany().HasForeignKey(x => x.OwnerId)` 声明 FK 依赖，让 EF 在一次 `SaveChanges` 同插
多个实体时正确排序级联插入——否则 register 同插 user + refresh_token 可能先插 token 触发 FK 失败。

## 14. 从真实请求读代码：`POST /api/v1/auth/register`

把前面各层串起来，跟一次注册走到底（`AuthService.Register`）：

```csharp
public async Task<AuthTokens> Register(RegisterRequest req) {
    // ① 校验（Validation）：缺字段/格式错抛 ApiException → 中间件转 422
    var email = Validation.Email(req.Email).ToLowerInvariant();
    var rawPassword = Validation.Password(req.Password);
    var nickname = Validation.Nickname(req.Nickname);
    var avatarId = Validation.AvatarFormat(req.AvatarId);
    if (!_avatars.Exists(avatarId)) throw ApiException.Validation("头像 ID 不存在", "avatarId");

    if (await _users.ExistsByEmail(email)) throw ApiException.Conflict("邮箱已被注册", "email");   // ② 唯一性预检
    if (await _users.ExistsByNickname(nickname)) throw ApiException.Conflict("昵称已被使用", "nickname");

    var user = new User { Id = Guid.NewGuid(), PasswordHash = _security.HashPassword(rawPassword), ... };  // ③ bcrypt
    _users.Add(user);                          // ④ 标记新增（EF 变更跟踪，未落库）
    var tokens = IssueTokenPair(user, null);   // ⑤ 同时标记 refresh_token 行新增
    await _db.SaveChangesAsync();              // ⑥ 一次性 INSERT（EF 按 FK 排序：user 先、token 后，见 §13）
    return tokens;
}
```

请求回到 `AuthController`：`Wrapped(tokens, StatusCodes.Status201Created)` 包成 201 响应。register 这里靠
`SaveChangesAsync()` 的隐式工作单元（一次提交多个挂起变更）保证原子；`Refresh`/`ChangePassword` 这类
"提交后还要决定抛不抛错"的场景才显式 `BeginTransactionAsync`（§9）。

## 15. 测试与契约验证

xUnit 测试集中验证纯逻辑不变式，尤其是 SQLite UUID/时间戳格式（`tests/CrossDbTests.cs`）：

```bash
./test
../../verification/scripts/verify-contract.sh aspnet
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh aspnet
```

黑盒契约从 HTTP 外部验证，不读取 EF Core 或 service 内部实现。

## 16. 常见改动应该改哪里

| 想改什么 | 动哪里 |
|---|---|
| 新增接口 | `Dto/Dtos.cs` 加 DTO → `Services/` 加业务 → `Controllers/` 加 action（用 `Wrapped(...)`） |
| 新增字段校验 | `Services/Validation.cs`（对照 spec/openapi.yaml） |
| 新增表/字段 | 先改 `spec/db` + 维护脚本 → `Domain/Entities.cs` → `AppDbContext.OnModelCreating` 列映射（SQLite 下加 converter） |
| 改响应结构 | `Services/MapperService.cs`（注意显式 null 字段） |
| 改跨库存储格式 | `Infrastructure/CrossDb.cs` + `ApplySqliteConverters()`（须双驱动复验） |
| 加单例/作用域服务 | `Program.cs` 选对 `AddSingleton`/`AddScoped`（§5.1） |
| 换 LLM 网关 | 环境变量即可；解析逻辑在 `Services/LlmClient.cs` |

## 17. 学到这里之后

读到这里，你已经掌握了这个 .NET 后端最关键的部分：最小宿主组装 + **DI 生命周期（singleton/scoped）**、
中间件洋葱模型、控制器基类兜底、EF Core 变更跟踪、跨库 `ValueConverter`、`BeginTransactionAsync` + outcome 枚举，
以及两个 .NET 特有调和（**HS256 密钥 SHA-256 派生、ClockSkew=0、FK 插入排序**）。

下一步建议：

- 跟着 §14 的注册链路，把 `Login` / `Refresh`（outcome 枚举）/ `FavoriteService.AddFavorite`（行锁 + EF 变更跟踪）也读一遍。
- 重点精读 §8 的 `CrossDb.cs`——它解释了"为什么 EF Core SQLite 的默认时间格式必须被接管"。
- 把本实现的 `ValueConverter` 和 `backends/ktor` 的 `CrossDbColumns`、`backends/spring-boot` 的 `@JdbcType`
  并排读——三个 JVM/.NET ORM 各自如何在"同一套实体"上分流跨库存储格式。

之后可深入 ASP.NET Core 进阶：minimal API（本项目用 Controllers）、EF Core 的编译查询与 `AsNoTracking`、
`IOptions<T>` 配置模式。本实现保持直观，把这些留给后续。

## 18. 读代码的路线

1. `Program.cs`：看 DI 生命周期、DbContext、中间件、静态资源、Controllers 如何装配（配合 §4/§5）。
2. `src/Web/ErrorHandlingMiddleware.cs` 和 `ApiControllerBase.cs`：看统一响应和错误边界。
3. `src/Dto/Dtos.cs` + `src/Services/Validation.cs`：看 API 形状与契约校验。
4. `src/Services/AuthService.cs`（§14）、`FavoriteService.cs`、`SecurityService.cs`：看核心业务与安全。
5. `src/Repositories/*`：看 EF Core 查询。
6. `src/Infrastructure/AppDbContext.cs` 和 `CrossDb.cs`：最后看跨库映射细节（§8）。
