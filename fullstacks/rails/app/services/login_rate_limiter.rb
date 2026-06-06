# 每邮箱失败次数滑动窗口限流（进程内单例）。教学项目：多 worker 下失效。
module LoginRateLimiter
  @failures = {}
  @mutex = Mutex.new

  module_function

  def check!(email)
    limit = AppConfig.login_rate_limit_per_minute
    now = monotonic_ms
    @mutex.synchronize do
      q = (@failures[email] ||= [])
      q.shift while q.any? && now - q.first > 60_000
      raise ApiError.rate_limited("操作过于频繁，请稍后再试") if q.size >= limit
    end
  end

  def record_failure(email)
    @mutex.synchronize { (@failures[email] ||= []) << monotonic_ms }
  end

  def monotonic_ms
    (Process.clock_gettime(Process::CLOCK_MONOTONIC) * 1000).to_i
  end
end
