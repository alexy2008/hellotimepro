using System.Globalization;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace HelloTimePro.Aspnet.Infrastructure;

/// <summary>
/// 跨库存储格式：在同一套 EF 实体上按 provider 分流读写格式。
/// 这是 ASP.NET/EF Core 版对 Ktor <c>CrossDbColumns</c> / Spring <c>CrossDb*JdbcType</c> 的等价实现。
///
/// - <b>SQLite</b>：spec schema 下 id 存 32 位无横线 hex TEXT；时间戳存 ISO-8601 TEXT（UTC、<c>+00:00</c>，
///   仅在有小数秒时输出小数部分——与 seed_demo 完全一致）。EF Core SQLite 默认把 DateTimeOffset 存成
///   空格分隔 + 7 位小数的 TEXT，会破坏「按字符串比较的 <c>open_at &lt;= now</c> / <c>ORDER BY created_at</c>」，
///   故必须用下面的 ValueConverter 接管格式。
/// - <b>Postgres</b>：原生 <c>uuid</c> / <c>timestamptz</c>，由 Npgsql 直接映射 Guid / DateTimeOffset，不加转换器。
/// </summary>
public static class CrossDb
{
    /// <summary>把 DateTimeOffset 序列化为 SQLite 存储用 ISO-8601（与 seed 对齐：T 分隔、+00:00、零小数不输出）。</summary>
    public static string FormatTimestamp(DateTimeOffset value)
    {
        var u = value.ToUniversalTime();
        var s = u.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        long frac = u.Ticks % TimeSpan.TicksPerSecond; // 100ns 单位，0..9_999_999
        if (frac != 0)
        {
            var fracStr = frac.ToString("D7", CultureInfo.InvariantCulture).TrimEnd('0');
            s += "." + fracStr;
        }
        return s + "+00:00";
    }

    /// <summary>解析 SQLite 存储的 ISO-8601 TEXT；容错旧数据的空格分隔。结果归一到 UTC。</summary>
    public static DateTimeOffset ParseTimestamp(string raw)
    {
        var s = raw.Trim();
        // 容错：旧数据可能用空格分隔（'2026-06-01 10:00:00+00:00'）。
        if (s.Length > 10 && s[10] == ' ')
        {
            s = string.Concat(s.AsSpan(0, 10), "T", s.AsSpan(11));
        }
        return DateTimeOffset.Parse(s, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.RoundtripKind).ToUniversalTime();
    }

    /// <summary>Guid → 32 位无横线小写 hex（与 Python uuid.hex / 现有 seed 一致）。</summary>
    public static string FormatGuid(Guid value) => value.ToString("N");

    /// <summary>解析 32 位 hex 或带横线的标准 UUID 字符串。</summary>
    public static Guid ParseGuid(string raw)
    {
        var s = raw.Trim();
        return s.Length == 32 ? Guid.ParseExact(s, "N") : Guid.Parse(s);
    }

    // SQLite 专用值转换器（仅在 DbDriver=sqlite 时挂到实体属性上）。
    public static readonly ValueConverter<Guid, string> GuidToHex =
        new(g => FormatGuid(g), s => ParseGuid(s));

    public static readonly ValueConverter<DateTimeOffset, string> TimestampToIso =
        new(d => FormatTimestamp(d), s => ParseTimestamp(s));

    // 可空时间戳（refresh_tokens.revoked_at）。
    public static readonly ValueConverter<DateTimeOffset?, string?> NullableTimestampToIso =
        new(d => d == null ? null : FormatTimestamp(d.Value),
            s => s == null ? null : ParseTimestamp(s));
}
