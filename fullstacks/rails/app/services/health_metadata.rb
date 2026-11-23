class HealthMetadata
  def self.build
    {
      status: "ok",
      service: AppConfig.service_name,
      version: AppConfig.service_version,
      uptimeSeconds: (Time.now - Rails.application.config.x.boot_time).to_i,
      stack: {
        kind: "fullstack",
        summary: "Rails 用 ERB 服务端渲染双皮肤页面，Turbo 更新页面与片段，Stimulus 管理浏览器内交互。" \
                 "Active Record 同时支持 PostgreSQL 和 SQLite，JWT JSON API 与 HttpOnly Cookie 网页同源运行。",
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
