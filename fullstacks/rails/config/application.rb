require_relative "boot"

require "rails"
# 中间件是普通类，需在 config 阶段（autoload 尚未就绪）就拿到常量，故显式 require。
require_relative "../lib/middleware/cookie_token_bridge"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/engine"
require "action_controller/railtie"
# require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
# require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module HellotimeRails
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks middleware])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # 时间统一 UTC（与契约/seed 一致）。
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    # schema/数据生命周期在应用之外（scripts/db）；本应用不迁移、不依赖 schema_migrations。
    config.active_record.migration_error = false
    config.active_record.dump_schema_after_migration = false

    # 教学项目：放开 Host 头校验（契约/冒烟用 127.0.0.1 直连本端口）。
    config.hosts.clear

    # cookie → Bearer 桥（让浏览器 fetch /api/v1 自动复用 Bearer 鉴权）。
    config.middleware.use CookieTokenBridge

    # Don't generate system test files.
    config.generators.system_tests = nil
  end
end
