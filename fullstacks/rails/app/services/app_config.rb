# 应用配置：全部来源于环境变量（由 scripts/hello start rails 注入），带合理默认值。
# 对应其它栈的 AppConfig；教学项目：JWT secret 默认值等生产级问题不作处理。
module AppConfig
  module_function

  def env(name, fallback)
    v = ENV[name]
    v.nil? || v.strip.empty? ? fallback : v
  end

  def service_name = "hellotime-pro"
  def service_version = "0.1.0"

  def db_driver = env("DB_DRIVER", "postgres")
  def db_url = ENV["DB_URL"]

  # 单一 sqlite 判定：DB_DRIVER=sqlite 或 DB_URL=sqlite:///...（与 database.yml 一致）。
  def sqlite?
    db_driver == "sqlite" || db_url.to_s.strip.start_with?("sqlite:///")
  end

  def repo_root
    @repo_root ||= File.expand_path(env("REPO_ROOT", File.expand_path("../../../..", __dir__)))
  end

  def jwt_secret = env("JWT_SECRET", "dev-secret-change-me")
  def access_token_ttl_seconds = env("ACCESS_TOKEN_TTL_SECONDS", "3600").to_i
  def refresh_token_ttl_seconds = env("REFRESH_TOKEN_TTL_SECONDS", "604800").to_i
  def login_rate_limit_per_minute = env("LOGIN_RATE_LIMIT_PER_MINUTE", "10").to_i

  def llm_enabled = env("LLM_ENABLED", "false").downcase == "true"
  def llm_provider = env("LLM_PROVIDER", "openai")
  def llm_base_url = env("LLM_BASE_URL", "https://api.openai.com/v1")
  def llm_api_key = env("LLM_API_KEY", "")
  def llm_model = env("LLM_MODEL", "gpt-4.1-mini")
  def llm_timeout_ms = env("LLM_TIMEOUT_MS", "30000").to_i
  def llm_max_retries = env("LLM_MAX_RETRIES", "2").to_i
  def llm_retry_backoff_ms = env("LLM_RETRY_BACKOFF_MS", "400").to_i
  def llm_api_style = env("LLM_API_STYLE", "chat")

  def llm_user_agent
    env("LLM_USER_AGENT",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " \
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
  end
end
