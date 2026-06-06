require "time"
require "securerandom"

# 跨库存储格式：SQLite 与 PostgreSQL 用不同表示，按方言分流。
#   - SQLite：id 存 32 位无横线 hex TEXT；时间戳存 ISO-8601 TEXT（UTC、+00:00，零小数不输出，
#     与 seed_demo 完全一致——靠字符串可比性支撑 open_at <= now / ORDER BY created_at）。
#   - Postgres：原生 uuid / timestamptz，ActiveRecord 直接处理（uuid 读出为带横线字符串、时间读出为 Time）。
#
# 仅在 SQLite 下把下面的自定义 ActiveRecord::Type 挂到列上（见 ApplicationRecord.cross_db_*）。
# 这是对 Ktor CrossDbColumns / Spring CrossDb*JdbcType / ASP.NET 值转换器的 Rails 等价实现。
module CrossDb
  module_function

  # ---- UUID ----

  def uuid_to_hex(value)
    value.to_s.delete("-").downcase
  end

  def hex_to_uuid(value)
    h = value.to_s.delete("-").downcase
    return value.to_s if h.length != 32
    "#{h[0, 8]}-#{h[8, 4]}-#{h[12, 4]}-#{h[16, 4]}-#{h[20, 12]}"
  end

  UUID_RE = /\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\z/

  # 宽松解析标准（带横线）UUID：非法格式返回 nil（调用方据此转 404 而非 500）。
  def parse_uuid_or_nil(value)
    s = value.to_s.strip
    UUID_RE.match?(s) ? s.downcase : nil
  end

  # ---- 时间戳 ----

  # Time → SQLite 存储用 ISO-8601（T 分隔、+00:00、零小数不输出，与 seed 对齐）。
  def format_timestamp(value)
    t = to_utc(value)
    s = t.strftime("%Y-%m-%dT%H:%M:%S")
    unless t.nsec.zero?
      frac = format("%09d", t.nsec).sub(/0+\z/, "")
      s += ".#{frac}"
    end
    "#{s}+00:00"
  end

  # SQLite 存储的 ISO-8601 TEXT → Time（UTC）。容错空格分隔的旧数据。
  def parse_timestamp(value)
    return value if value.is_a?(Time)
    s = value.to_s.strip
    s = "#{s[0, 10]}T#{s[11..]}" if s.length > 10 && s[10] == " "
    Time.iso8601(s).utc
  rescue ArgumentError
    Time.parse(value.to_s).utc
  end

  # API 响应用 ISO-8601 UTC instant（...Z，零小数不输出，对齐其它栈）。
  def iso_instant(value)
    return nil if value.nil?
    t = to_utc(value)
    s = t.strftime("%Y-%m-%dT%H:%M:%S")
    s += ".#{format('%09d', t.nsec).sub(/0+\z/, '')}" unless t.nsec.zero?
    "#{s}Z"
  end

  def to_utc(value)
    case value
    when Time then value.getutc
    when nil then nil
    else value.to_time.getutc
    end
  end

  # ---- ActiveRecord 自定义类型（仅 SQLite 挂载） ----

  class SqliteUuidType < ActiveRecord::Type::Value
    def cast(value)
      value.nil? ? nil : CrossDb.hex_to_uuid(value)
    end

    def deserialize(value)
      value.nil? ? nil : CrossDb.hex_to_uuid(value)
    end

    def serialize(value)
      value.nil? ? nil : CrossDb.uuid_to_hex(value)
    end
  end

  class SqliteTimestampType < ActiveRecord::Type::Value
    def cast(value)
      case value
      when nil then nil
      when Time then value.getutc
      when String then CrossDb.parse_timestamp(value)
      else value.respond_to?(:to_time) ? value.to_time.getutc : value
      end
    end

    def deserialize(value)
      value.nil? ? nil : CrossDb.parse_timestamp(value)
    end

    def serialize(value)
      value.nil? ? nil : CrossDb.format_timestamp(value)
    end
  end
end
