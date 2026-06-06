using System.Globalization;

namespace HelloTimePro.Aspnet.Services;

/// <summary>时间与 UUID 的小工具。响应里的时间统一序列化为 ISO-8601 UTC（<c>...Z</c>）。</summary>
public static class Times
{
    public static DateTimeOffset NowUtc() => DateTimeOffset.UtcNow;

    /// <summary>序列化为 ISO-8601 UTC instant（零小数不输出，对齐 JVM 的 Instant.toString）。</summary>
    public static string Iso(DateTimeOffset value)
    {
        var u = value.ToUniversalTime();
        var s = u.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        long frac = u.Ticks % TimeSpan.TicksPerSecond;
        if (frac != 0)
        {
            s += "." + frac.ToString("D7", CultureInfo.InvariantCulture).TrimEnd('0');
        }
        return s + "Z";
    }

    /// <summary>宽松解析 UUID：非法格式返回 null（调用方据此转 404 而非 500）。</summary>
    public static Guid? ParseUuidOrNull(string? value) =>
        Guid.TryParse(value, out var g) ? g : null;
}
