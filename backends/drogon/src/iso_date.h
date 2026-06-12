#pragma once

#include <cstdint>
#include <optional>
#include <string>

// 时间格式工具：领域时间统一为 UTC 微秒时间戳（int64_t），解析/输出 ISO-8601，
// 并保证 SQLite TEXT 落库格式与 seed 一致。
//
// - **SQLite 落库**：`yyyy-MM-ddTHH:mm:ss.SSSSSS+00:00`（微秒 + 显式零偏移），
//   与 Python seed / 其它栈对齐；同一格式下字符串比较即时间比较。
// - **JSON 输出**：`yyyy-MM-ddTHH:mm:ss.SSSZ`（毫秒 + Z）。
// - 解析容忍：空格分隔、可变小数位（0-9 位）、Z / ±HH / ±HH:MM / ±HHMM / 缺省偏移
//   （PG timestamptz 的文本输出形如 `2026-06-12 08:30:00.123456+00`，必须能读回）。

namespace iso_date
{
using Micros = int64_t;

std::optional<Micros> parse(const std::string &raw);
std::string sqliteString(Micros t);
std::string jsonString(Micros t);

Micros now();
Micros addSeconds(Micros t, int64_t seconds);
// 日历语义的 +N 年（UTC）；2/29 会按 timegm 规则归一化到 3/1。
Micros addYearsUtc(Micros t, int years);
}  // namespace iso_date
