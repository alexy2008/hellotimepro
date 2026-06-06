using System.Text.Json;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Dto;

namespace HelloTimePro.Aspnet.Services;

/// <summary>从 spec/avatars/catalog.json 加载内置头像目录（启动时一次）。单例。</summary>
public sealed class AvatarService
{
    private readonly IReadOnlyList<AvatarDto> _avatars;
    private readonly HashSet<string> _ids;

    public AvatarService(AppConfig config)
    {
        var path = Path.GetFullPath(Path.Combine(config.RepoRoot, "spec", "avatars", "catalog.json"));
        var text = File.ReadAllText(path);
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };
        var catalog = JsonSerializer.Deserialize<Catalog>(text, options)
                      ?? throw new InvalidOperationException("头像目录解析失败");
        _avatars = catalog.Avatars;
        _ids = catalog.Avatars.Select(a => a.Id).ToHashSet();
    }

    public IReadOnlyList<AvatarDto> List() => _avatars;

    public bool Exists(string id) => _ids.Contains(id);

    private sealed record Catalog(List<AvatarDto> Avatars);
}
