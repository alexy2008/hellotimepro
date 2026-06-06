using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1")]
public sealed class HealthController : ApiControllerBase
{
    private readonly AppConfig _config;
    public HealthController(AppConfig config) => _config = config;

    [HttpGet("health")]
    public IActionResult Health()
    {
        var isSqlite = _config.IsSqlite;
        const string summary =
            "基于 C# + ASP.NET Core + EF Core 的服务端实现。Kestrel 承载 HTTP，控制器分层（presentation→" +
            "application→domain→infrastructure），EF Core 提供 LINQ 查询与变更跟踪，同时支持 PostgreSQL 与 SQLite。" +
            "针对跨库差异，按 provider 挂载值转换器（SQLite 把 UUID 存成 32 位无横线 hex、时间戳存 ISO-8601 TEXT，" +
            "覆盖 EF 默认格式以保证字符串比较的 open_at <= now / ORDER BY created_at 正确；Postgres 走 Npgsql 原生 " +
            "uuid / timestamptz）。Postgres 路径用 SELECT ... FOR UPDATE 行锁保证收藏计数与 refresh token 轮转的并发一致性。" +
            "JWT（HS256）+ refresh token 轮转与家族吊销实现鉴权；手写字段校验对齐契约的正则与长度约束；" +
            "中间件把业务异常统一转换为契约约定的错误响应外壳。";

        var items = new List<StackItem>
        {
            new("language", "C#", "12", "/static/icons/csharp.svg"),
            new("framework", "ASP.NET Core", "8.0", "/static/icons/aspnet.svg"),
            new("runtime", ".NET", Environment.Version.ToString(), "/static/icons/dotnet.svg"),
            new("orm", "EF Core", "8.0", "/static/icons/dotnet.svg"),
            new("database",
                isSqlite ? "SQLite" : "PostgreSQL",
                isSqlite ? "3" : "16",
                $"/static/icons/{(isSqlite ? "sqlite" : "postgresql")}.svg"),
        };

        var uptime = (long)(DateTimeOffset.UtcNow - _config.StartedAt).TotalSeconds;
        var data = new HealthData("ok", _config.ServiceName, _config.ServiceVersion, uptime,
            new StackInfo("backend", summary, items));
        return Wrapped(data);
    }
}
