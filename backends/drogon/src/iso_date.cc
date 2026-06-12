#include "iso_date.h"

#include <chrono>
#include <cstdio>
#include <ctime>
#include <regex>

namespace iso_date
{
namespace
{
const std::regex &parser()
{
    static const std::regex re(
        R"(^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|z|[+-]\d{2}(?::?\d{2})?)?$)");
    return re;
}

std::string trim(const std::string &s)
{
    auto begin = s.find_first_not_of(" \t");
    auto end = s.find_last_not_of(" \t");
    if (begin == std::string::npos)
        return "";
    return s.substr(begin, end - begin + 1);
}
}  // namespace

std::optional<Micros> parse(const std::string &raw)
{
    const std::string s = trim(raw);
    std::smatch m;
    if (!std::regex_match(s, m, parser()))
        return std::nullopt;

    std::tm tm{};
    tm.tm_year = std::stoi(m[1].str()) - 1900;
    tm.tm_mon = std::stoi(m[2].str()) - 1;
    tm.tm_mday = std::stoi(m[3].str());
    tm.tm_hour = std::stoi(m[4].str());
    tm.tm_min = std::stoi(m[5].str());
    tm.tm_sec = std::stoi(m[6].str());

    // timegm 会把非法日期归一化（如 13 月），这里先做范围校验。
    if (tm.tm_mon < 0 || tm.tm_mon > 11 || tm.tm_mday < 1 || tm.tm_mday > 31 ||
        tm.tm_hour > 23 || tm.tm_min > 59 || tm.tm_sec > 60)
        return std::nullopt;

    std::tm probe = tm;
    const time_t base = timegm(&probe);
    if (base == -1)
        return std::nullopt;
    // timegm 归一化检测：日期分量变了说明输入非法（如 2 月 30 日）。
    if (probe.tm_mday != tm.tm_mday || probe.tm_mon != tm.tm_mon)
        return std::nullopt;

    int64_t micros = static_cast<int64_t>(base) * 1000000;
    if (m[7].matched)
    {
        std::string frac = m[7].str();
        frac.resize(9, '0');  // 纳秒位
        micros += std::stoll(frac) / 1000;
    }
    if (m[8].matched)
    {
        const std::string off = m[8].str();
        if (off != "Z" && off != "z")
        {
            const int sign = off[0] == '-' ? -1 : 1;
            std::string digits;
            for (size_t i = 1; i < off.size(); ++i)
                if (off[i] != ':')
                    digits.push_back(off[i]);
            int hours = 0, minutes = 0;
            if (digits.size() == 2)
                hours = std::stoi(digits);
            else if (digits.size() == 4)
            {
                hours = std::stoi(digits.substr(0, 2));
                minutes = std::stoi(digits.substr(2));
            }
            else
                return std::nullopt;
            micros -= static_cast<int64_t>(sign) * (hours * 3600 + minutes * 60) * 1000000;
        }
    }
    return micros;
}

namespace
{
std::string format(Micros t, int fractionDigits)
{
    const int64_t micros = ((t % 1000000) + 1000000) % 1000000;
    const time_t seconds = static_cast<time_t>((t - micros) / 1000000);
    std::tm tm{};
    gmtime_r(&seconds, &tm);
    char head[32];
    std::snprintf(head, sizeof(head), "%04d-%02d-%02dT%02d:%02d:%02d", tm.tm_year + 1900,
                  tm.tm_mon + 1, tm.tm_mday, tm.tm_hour, tm.tm_min, tm.tm_sec);
    char frac[16];
    if (fractionDigits == 6)
        std::snprintf(frac, sizeof(frac), ".%06lld", static_cast<long long>(micros));
    else
        std::snprintf(frac, sizeof(frac), ".%03lld", static_cast<long long>(micros / 1000));
    return std::string(head) + frac;
}
}  // namespace

std::string sqliteString(Micros t)
{
    return format(t, 6) + "+00:00";
}

std::string jsonString(Micros t)
{
    return format(t, 3) + "Z";
}

Micros now()
{
    return std::chrono::duration_cast<std::chrono::microseconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

Micros addSeconds(Micros t, int64_t seconds)
{
    return t + seconds * 1000000;
}

Micros addYearsUtc(Micros t, int years)
{
    const int64_t micros = ((t % 1000000) + 1000000) % 1000000;
    const time_t seconds = static_cast<time_t>((t - micros) / 1000000);
    std::tm tm{};
    gmtime_r(&seconds, &tm);
    tm.tm_year += years;
    const time_t shifted = timegm(&tm);
    return static_cast<int64_t>(shifted) * 1000000 + micros;
}
}  // namespace iso_date
