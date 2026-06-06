class HealthMetadata
  def self.build
    sqlite = AppConfig.sqlite?
    {
      status: "ok",
      service: AppConfig.service_name,
      version: AppConfig.service_version,
      uptimeSeconds: (Time.now - Rails.application.config.x.boot_time).to_i,
      stack: {
        kind: "fullstack",
        summary: summary,
        items: stack_items(sqlite),
      },
    }
  end

  def self.summary
    "基于 Ruby + Ruby on Rails 的服务端渲染全栈实现。Puma 承载 HTTP，控制器分层，" \
      "Active Record 提供模型与查询，同时支持 PostgreSQL 与 SQLite；针对跨库差异用自定义 " \
      "ActiveRecord::Type 按方言分流（SQLite 把 UUID 存成 32 位无横线 hex、时间戳存 ISO-8601 TEXT，" \
      "保证字符串比较的 open_at <= now / ORDER BY created_at 正确；Postgres 走原生 uuid / timestamptz）。" \
      "/api/v1 JSON 接口（Bearer）与 Hotwire（Turbo + Stimulus）服务端渲染 UI（httpOnly cookie）同源共存，" \
      "cookie→Bearer 桥让浏览器 fetch 复用同一套鉴权；Postgres 路径用 SELECT ... FOR UPDATE 行锁保证" \
      "收藏计数与 refresh token 轮转的并发一致性。JWT（HS256）+ refresh token 轮转与家族吊销实现鉴权。"
  end

  def self.stack_items(sqlite)
    [
      { role: "language", name: "Ruby", version: RUBY_VERSION, iconUrl: "/static/icons/ruby.svg" },
      { role: "framework", name: "Ruby on Rails", version: Rails.version, iconUrl: "/static/icons/rails.svg" },
      { role: "orm", name: "Active Record", version: Rails.version, iconUrl: "/static/icons/rails.svg" },
      {
        role: "database",
        name: sqlite ? "SQLite" : "PostgreSQL",
        version: sqlite ? "3" : "16",
        iconUrl: "/static/icons/#{sqlite ? 'sqlite' : 'postgresql'}.svg",
      },
    ]
  end
end
