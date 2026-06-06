using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Services;
using Xunit;

namespace HelloTimePro.Aspnet.Tests;

/// <summary>
/// 跨库存储格式是整套实现里最易踩坑的部分：SQLite 用字符串比较 open_at/created_at，
/// 写出格式必须与 seed_demo 完全一致（T 分隔、+00:00、零小数不输出），否则排序/过滤错。
/// 这里固定住这些不变式。
/// </summary>
public class CrossDbTests
{
    [Fact]
    public void Timestamp_WholeSecond_HasNoFraction_MatchesSeed()
    {
        var dto = new DateTimeOffset(2025, 8, 1, 1, 0, 0, TimeSpan.Zero);
        Assert.Equal("2025-08-01T01:00:00+00:00", CrossDb.FormatTimestamp(dto));
    }

    [Fact]
    public void Timestamp_Fractional_TrimsTrailingZeros()
    {
        var dto = new DateTimeOffset(2026, 6, 5, 9, 27, 4, TimeSpan.Zero).AddTicks(4_810_000); // .481
        Assert.Equal("2026-06-05T09:27:04.481+00:00", CrossDb.FormatTimestamp(dto));
    }

    [Fact]
    public void Timestamp_NonUtcOffset_NormalizedToUtc()
    {
        var dto = new DateTimeOffset(2026, 6, 5, 18, 0, 0, TimeSpan.FromHours(8));
        Assert.Equal("2026-06-05T10:00:00+00:00", CrossDb.FormatTimestamp(dto));
    }

    [Fact]
    public void Timestamp_RoundTrips()
    {
        var dto = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero);
        Assert.Equal(dto, CrossDb.ParseTimestamp(CrossDb.FormatTimestamp(dto)));
    }

    [Fact]
    public void Timestamp_StringOrder_IsChronological_AcrossSeedAndAppRows()
    {
        // seed 行（无小数） vs 应用行（有小数）必须按字符串正确排序。
        var seed = CrossDb.FormatTimestamp(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero));
        var appLater = CrossDb.FormatTimestamp(new DateTimeOffset(2026, 6, 5, 9, 27, 4, TimeSpan.Zero).AddTicks(4_810_000));
        Assert.True(string.CompareOrdinal(seed, appLater) < 0);
    }

    [Fact]
    public void Guid_Hex_Is32LowerNoDashes_MatchesPythonHex()
    {
        var g = Guid.Parse("02b648cf-3b6d-506f-aa4d-0f73d91d3d82");
        Assert.Equal("02b648cf3b6d506faa4d0f73d91d3d82", CrossDb.FormatGuid(g));
    }

    [Fact]
    public void Guid_Parse_AcceptsHexAndDashed()
    {
        var expected = Guid.Parse("02b648cf-3b6d-506f-aa4d-0f73d91d3d82");
        Assert.Equal(expected, CrossDb.ParseGuid("02b648cf3b6d506faa4d0f73d91d3d82"));
        Assert.Equal(expected, CrossDb.ParseGuid("02b648cf-3b6d-506f-aa4d-0f73d91d3d82"));
    }

    [Fact]
    public void Iso_Output_UsesZSuffix()
    {
        var dto = new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
        Assert.Equal("2026-06-05T10:00:00Z", Times.Iso(dto));
    }

    // sqlite 判定必须与 DbUrl.Resolve 选 provider 的规则一致（单一事实源），
    // 否则 DB_URL=sqlite:/// 单独传时会出现「选了 SQLite provider 但没挂值转换器」的错配。
    [Theory]
    [InlineData("sqlite", null, true)]
    [InlineData("postgres", "sqlite:///abs/path.db", true)]      // 仅 DB_URL 指明 sqlite
    [InlineData("postgres", null, false)]
    [InlineData("postgres", "postgresql://u:p@h:5432/db", false)]
    public void ResolveIsSqlite_MatchesDbUrlResolve(string driver, string? url, bool expected)
    {
        Assert.Equal(expected, AppConfig.ResolveIsSqlite(driver, url));
        Assert.Equal(expected, DbUrl.Resolve(driver, url, ".").IsSqlite);
    }
}
