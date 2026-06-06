using System.Globalization;
using System.Text.Json.Nodes;
using HelloTimePro.Aspnet.Config;

namespace HelloTimePro.Aspnet.Services;

/// <summary>读取仓库内 prompt 模板（缺失则空串，使用各服务内置默认模板）。</summary>
public static class Templates
{
    public static string Load(AppConfig config, string relativePath)
    {
        try
        {
            var path = Path.GetFullPath(Path.Combine(config.RepoRoot, relativePath));
            return File.Exists(path) ? File.ReadAllText(path) : "";
        }
        catch
        {
            return "";
        }
    }
}

/// <summary>JsonNode 取值辅助：类型不符 / 缺失统一返回 null，不抛异常。</summary>
public static class JsonExt
{
    public static string? StringOrNull(this JsonNode? node)
    {
        if (node is null) return null;
        try { return node.GetValue<string>(); }
        catch { return node.ToString(); }
    }

    public static int? IntOrNull(this JsonNode? node)
    {
        if (node is null) return null;
        try { return node.GetValue<int>(); }
        catch
        {
            var s = node.ToString();
            if (int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i)) return i;
            if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d)) return (int)d;
            return null;
        }
    }
}
