using System.Collections.Concurrent;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

/// <summary>
/// 每邮箱失败次数滑动窗口限流（单例、进程内）。教学项目：多 worker 下失效，见 docs/dev-notes.md §1。
/// </summary>
public sealed class LoginRateLimiter
{
    private readonly int _limitPerMinute;
    private readonly ConcurrentDictionary<string, Queue<long>> _failures = new();

    public LoginRateLimiter(AppConfig config) => _limitPerMinute = config.LoginRateLimitPerMinute;

    /// <summary>登录前调用：窗口内失败数达到上限则抛 RATE_LIMITED。</summary>
    public void Check(string email)
    {
        var bucket = _failures.GetOrAdd(email, _ => new Queue<long>());
        var now = Environment.TickCount64;
        lock (bucket)
        {
            while (bucket.Count > 0 && now - bucket.Peek() > 60_000) bucket.Dequeue();
            if (bucket.Count >= _limitPerMinute)
            {
                throw ApiException.RateLimited("操作过于频繁，请稍后再试");
            }
        }
    }

    public void RecordFailure(string email)
    {
        var bucket = _failures.GetOrAdd(email, _ => new Queue<long>());
        lock (bucket) bucket.Enqueue(Environment.TickCount64);
    }
}
