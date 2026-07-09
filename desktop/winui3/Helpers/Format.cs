using System;
using System.Globalization;

namespace HelloTimePro.Helpers;

// ============================================================
// 格式化工具（对齐 frontends/react-ts/src/utils/format.ts）：倒计时 / 时间 / 数字。
// ISO 时间统一按 UTC 解析后转本地时区展示（同 JS new Date(iso)）。
// ============================================================

public readonly record struct Countdown(bool Expired, long TotalSeconds, int Days, int Hours, int Minutes, int Seconds);

public static class Format
{
    private static readonly CultureInfo Zh = CultureInfo.GetCultureInfo("zh-CN");

    public static Countdown CountdownTo(string iso, DateTimeOffset? nowOverride = null)
    {
        var now = nowOverride ?? DateTimeOffset.Now;
        if (!DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var target))
            return new Countdown(true, 0, 0, 0, 0, 0);
        var diff = (long)Math.Max(0, Math.Floor((target - now).TotalSeconds));
        return new Countdown(
            Expired: target <= now,
            TotalSeconds: diff,
            Days: (int)(diff / 86400),
            Hours: (int)(diff % 86400 / 3600),
            Minutes: (int)(diff % 3600 / 60),
            Seconds: (int)(diff % 60));
    }

    /// 未开启卡片的倒计时文案：⏳ 还剩 N 天 · HH:MM:SS
    public static string CountdownText(string openAt)
    {
        var cd = CountdownTo(openAt);
        return $"⏳ 还剩 {FmtNumber(cd.Days)} 天 · {cd.Hours:D2}:{cd.Minutes:D2}:{cd.Seconds:D2}";
    }

    public static string FmtDateTime(string iso)
    {
        if (!TryLocal(iso, out var d)) return iso;
        return d.ToString("yyyy/MM/dd HH:mm", Zh);
    }

    public static string FmtDate(string iso)
    {
        if (!TryLocal(iso, out var d)) return iso;
        return d.ToString("yyyy/MM/dd", Zh);
    }

    public static string FmtNumber(long n) => n.ToString("#,0", Zh);

    private static bool TryLocal(string iso, out DateTimeOffset local)
    {
        if (DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out var d))
        {
            local = d.ToLocalTime();
            return true;
        }
        local = default;
        return false;
    }
}
