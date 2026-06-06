using System.Text.Encodings.Web;
using System.Text.Json;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ── 配置（环境变量驱动，由 scripts/hello 注入） ──────────────────────────────
var config = new AppConfig();
builder.WebHost.UseUrls($"http://{config.Host}:{config.Port}");
builder.Logging.SetMinimumLevel(LogLevel.Information);

// ── JSON：camelCase + 原始 UTF-8（中文不转义），MVC 与错误中间件共用同一套选项 ──
var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
};

builder.Services.AddSingleton(config);
builder.Services.AddSingleton(jsonOptions);

// 单例（无 per-request 状态 / 启动时一次性加载）。
builder.Services.AddSingleton<SecurityService>();
builder.Services.AddSingleton<AvatarService>();
builder.Services.AddSingleton<MapperService>();
builder.Services.AddSingleton<LoginRateLimiter>();
builder.Services.AddSingleton<LlmClient>();
builder.Services.AddSingleton<CapsuleSuggestionService>();
builder.Services.AddSingleton<CapsuleRecommendationService>();

// EF Core 上下文：按 DB_DRIVER / DB_URL 选择 provider（scoped）。
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var cfg = sp.GetRequiredService<AppConfig>();
    var resolved = DbUrl.Resolve(cfg.DbDriver, cfg.DbUrl, cfg.RepoRoot);
    if (resolved.IsSqlite)
        options.UseSqlite(resolved.ConnectionString);
    else
        options.UseNpgsql(resolved.ConnectionString);
});

// 仓库 / 应用服务 / 鉴权上下文（scoped，随请求生命周期与 DbContext 一致）。
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<CapsuleRepository>();
builder.Services.AddScoped<FavoriteRepository>();
builder.Services.AddScoped<RefreshTokenRepository>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<CapsuleService>();
builder.Services.AddScoped<PlazaService>();
builder.Services.AddScoped<FavoriteService>();
builder.Services.AddScoped<AuthContext>();

// 业务异常自己转换为契约外壳，禁用 [ApiController] 的自动 400 ModelState 校验。
builder.Services.Configure<ApiBehaviorOptions>(o => o.SuppressModelStateInvalidFilter = true);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// 错误中间件最外层：把业务/反序列化/未捕获异常统一转换为契约约定的错误外壳。
app.UseMiddleware<ErrorHandlingMiddleware>();

// 静态资源：头像 / 技术栈图标（相对仓库根的 spec/ 目录）。
var repoRoot = Path.GetFullPath(config.RepoRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(repoRoot, "spec", "avatars")),
    RequestPath = "/static/avatars",
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(repoRoot, "spec", "icons")),
    RequestPath = "/static/icons",
});

app.UseCors();
app.MapControllers();

app.Run();
