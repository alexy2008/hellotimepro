#pragma once

#include <chrono>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

// 每邮箱失败次数滑动窗口（教学项目：进程内存实现，多 worker 下失效，
// 见 docs/dev-notes.md §1）。drogon 多 IO 线程并发访问，用互斥锁保护。
class LoginRateLimiter
{
  public:
    explicit LoginRateLimiter(size_t limit) : limit_(limit)
    {
    }

    bool isLimited(const std::string &email)
    {
        const auto cutoff = std::chrono::steady_clock::now() - std::chrono::seconds(60);
        std::lock_guard<std::mutex> guard(mutex_);
        auto &bucket = failures_[email];
        std::erase_if(bucket, [cutoff](const auto &t) { return t <= cutoff; });
        return bucket.size() >= limit_;
    }

    void recordFailure(const std::string &email)
    {
        std::lock_guard<std::mutex> guard(mutex_);
        failures_[email].push_back(std::chrono::steady_clock::now());
    }

  private:
    size_t limit_;
    std::mutex mutex_;
    std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>>
        failures_;
};
