using HelloTimePro.Aspnet.Config;

namespace HelloTimePro.Aspnet.Infrastructure;

/// <summary>
/// 把 hello 注入的 <c>DB_URL</c> 解析为 EF provider 的连接字符串。
/// 支持 <c>sqlite:///&lt;abs path&gt;</c> 与 <c>postgresql[+driver]://user:pass@host:port/db</c>。
/// （验证脚本会注入 <c>postgresql+psycopg://</c> 前缀，按 <c>://</c> 切分后忽略驱动后缀即可。）
/// </summary>
public static class DbUrl
{
    public sealed record Resolved(bool IsSqlite, string ConnectionString, string SqlitePath = "");

    public static Resolved Resolve(string dbDriver, string? rawUrl, string repoRoot)
    {
        var raw = string.IsNullOrWhiteSpace(rawUrl) ? null : rawUrl!.Trim();
        var sqlite = AppConfig.ResolveIsSqlite(dbDriver, raw);

        if (sqlite)
        {
            var path = raw is not null && raw.StartsWith("sqlite:///")
                ? raw.Substring("sqlite:///".Length)
                : Path.Combine(AbsRepoRoot(repoRoot), "data", "sqlite", "hellotime-aspnet.db");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            // Foreign Keys=True：与 spec schema 的 ON DELETE CASCADE 行为一致。
            return new Resolved(true, $"Data Source={path};Foreign Keys=True", path);
        }

        if (raw is null)
        {
            return new Resolved(false,
                "Host=127.0.0.1;Port=5432;Database=hellotime_pro;Username=hellotime;Password=hellotime;SSL Mode=Disable");
        }

        // postgresql://user:pass@host:port/db  （也接受 postgres:// 或 postgresql+psycopg:// 前缀）
        var rest = raw[(raw.IndexOf("://", StringComparison.Ordinal) + 3)..];
        var hasCreds = rest.Contains('@');
        var creds = hasCreds ? rest[..rest.LastIndexOf('@')] : "";
        var hostPart = hasCreds ? rest[(rest.LastIndexOf('@') + 1)..] : rest;

        var user = creds.Contains(':') ? creds[..creds.IndexOf(':')] : creds;
        var pass = creds.Contains(':') ? creds[(creds.IndexOf(':') + 1)..] : "";

        var hostPort = hostPart.Contains('/') ? hostPart[..hostPart.IndexOf('/')] : hostPart;
        var dbName = hostPart.Contains('/') ? hostPart[(hostPart.IndexOf('/') + 1)..] : hostPart;
        // 去掉可能的查询串（?sslmode=...）。
        var qIdx = dbName.IndexOf('?');
        if (qIdx >= 0) dbName = dbName[..qIdx];

        var host = hostPort.Contains(':') ? hostPort[..hostPort.IndexOf(':')] : hostPort;
        var port = hostPort.Contains(':') ? hostPort[(hostPort.IndexOf(':') + 1)..] : "5432";

        var cs = $"Host={host};Port={port};Database={dbName};Username={user};Password={pass};SSL Mode=Disable";
        return new Resolved(false, cs);
    }

    private static string AbsRepoRoot(string repoRoot) =>
        Path.GetFullPath(repoRoot);
}
