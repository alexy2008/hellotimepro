# 纯逻辑冒烟：固定跨库存储格式不变式（SQLite 字符串比较 open_at/created_at 的前提）。
# 由 ./test 通过 `rails runner` 执行。
require "time"

def assert(cond, msg)
  raise "FAIL: #{msg}" unless cond

  puts "  ✓ #{msg}"
end

t = Time.utc(2025, 8, 1, 1, 0, 0)
assert(CrossDb.format_timestamp(t) == "2025-08-01T01:00:00+00:00", "整秒时间无小数、+00:00（与 seed 一致）")

frac = Time.utc(2026, 6, 5, 9, 27, 4) + Rational(481, 1000)
assert(CrossDb.format_timestamp(frac) == "2026-06-05T09:27:04.481+00:00", "小数秒去尾零")

assert(CrossDb.parse_timestamp("2026-03-01T00:00:00+00:00") == Time.utc(2026, 3, 1), "ISO 往返")

seed = CrossDb.format_timestamp(Time.utc(2026, 3, 1))
app_later = CrossDb.format_timestamp(frac)
assert(seed < app_later, "seed(无小数) 与 app(有小数) 字符串序即时序")

assert(CrossDb.uuid_to_hex("02b648cf-3b6d-506f-aa4d-0f73d91d3d82") == "02b648cf3b6d506faa4d0f73d91d3d82", "uuid→32位hex")
assert(CrossDb.hex_to_uuid("02b648cf3b6d506faa4d0f73d91d3d82") == "02b648cf-3b6d-506f-aa4d-0f73d91d3d82", "32位hex→uuid")

assert(CrossDb.iso_instant(Time.utc(2026, 6, 5, 10, 0, 0)) == "2026-06-05T10:00:00Z", "API 输出用 Z 后缀")

assert(AppConfig.sqlite? == true, "DB_DRIVER=sqlite 时 AppConfig.sqlite? 为真")

puts "✓ Rails smoke 全部通过"
