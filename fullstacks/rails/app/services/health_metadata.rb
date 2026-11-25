class HealthMetadata
  def self.build
    {
      status: "ok",
      service: AppConfig.service_name,
      version: AppConfig.service_version,
      uptimeSeconds: (Time.now - Rails.application.config.x.boot_time).to_i,
      stack: {
        kind: "fullstack",
        summary: "基于 Ruby 与 Ruby on Rails 8 实现同源服务端，通过显式路由与薄控制器同时承载 SSR 网页与 /api/v1/* JSON 契约，" \
                 "领域逻辑集中在 app/services 层复用。认证层以 HttpOnly Cookie 维护网页会话，并以 HS256 JWT 及 Refresh Token " \
                 "家族轮换服务 API 请求，统一由基础控制器封装契约响应外壳与错误码。持久层基于 Active Record 映射表结构与关联，" \
                 "支持按环境变量在 PostgreSQL 与 SQLite 双库间无缝切换。",
        items: stack_items(AppConfig.sqlite?),
      },
    }
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
