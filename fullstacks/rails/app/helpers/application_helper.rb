module ApplicationHelper
  require "time"

  def avatar_url(avatar_id)
    "/static/avatars/#{avatar_id}.svg"
  end

  def icon_url(name)
    "/static/icons/#{name}.svg"
  end

  # 用户菜单 chip 上显示的短名（完整昵称放在 title 属性）。
  def short_name(nickname)
    s = nickname.to_s
    s.length > 4 ? "#{s[0, 4]}…" : s
  end

  # ISO-8601 字符串（...Z）→ 友好展示。
  def fmt_date(iso)
    parse_iso_time(iso)&.in_time_zone&.strftime("%Y/%m/%d") || iso.to_s[0, 10]
  end

  def fmt_datetime(iso)
    parse_iso_time(iso)&.in_time_zone&.strftime("%Y/%m/%d %H:%M") ||
      iso.to_s.sub("T", " ").sub("Z", "").sub(/\.\d+/, "")
  end

  def datetime_local_value(iso)
    parse_iso_time(iso)&.in_time_zone&.strftime("%Y-%m-%dT%H:%M")
  end

  def countdown_parts(iso)
    target = parse_iso_time(iso)
    seconds = target ? [(target - Time.current).floor, 0].max : 0
    {
      days: seconds / 86_400,
      hours: (seconds % 86_400) / 3_600,
      minutes: (seconds % 3_600) / 60,
      seconds: seconds % 60,
      expired: target ? target <= Time.current : false,
    }
  end

  def compact_countdown_text(iso)
    parts = countdown_parts(iso)
    return "正在开启…" if parts[:expired]

    "⏳ 还剩 #{parts[:days]} 天 · #{format('%02d', parts[:hours])}:#{format('%02d', parts[:minutes])}:#{format('%02d', parts[:seconds])}"
  end

  def page_href(path, page, extra = {})
    query = extra.merge(page: page).compact_blank
    query.empty? ? path : "#{path}?#{query.to_query}"
  end

  private

  def parse_iso_time(iso)
    return nil if iso.blank?

    Time.iso8601(iso.to_s)
  rescue ArgumentError
    Time.zone.parse(iso.to_s)
  end
end
