use std::env;
use std::path::PathBuf;

/// 应用配置：全部来源于环境变量（由 `scripts/hello start axum` 注入），带合理默认值。
///
/// 对应 Vapor 的 AppConfig。教学项目：JWT secret 默认值等生产级问题不作处理。
#[derive(Clone)]
pub struct AppConfig {
    pub service_name: &'static str,
    pub service_version: &'static str,
    pub host: String,
    /// hello CLI 不注入 PORT，默认端口必须直接是登记端口 29070（见 docs/dev-notes.md §6.5）。
    pub port: u16,
    pub db_driver: String,
    pub db_url: Option<String>,
    pub repo_root: String,
    pub jwt_secret: String,
    pub access_token_ttl_seconds: i64,
    pub refresh_token_ttl_seconds: i64,
    pub login_rate_limit_per_minute: usize,
    pub llm: LlmConfig,
}

#[derive(Clone)]
pub struct LlmConfig {
    pub enabled: bool,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout_ms: u64,
    /// 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数，见 docs/dev-notes.md §3.3
    pub max_retries: u32,
    pub retry_backoff_ms: u64,
    /// chat（默认，多数兼容网关只支持它）| responses | auto
    pub api_style: String,
    /// 避免被网关按默认 UA 封禁（Cloudflare 1010）
    pub user_agent: String,
}

fn env_or(name: &str, fallback: &str) -> String {
    match env::var(name) {
        Ok(v) if !v.is_empty() => v,
        _ => fallback.to_string(),
    }
}

impl AppConfig {
    pub fn from_environment() -> Self {
        AppConfig {
            service_name: "hellotime-pro",
            service_version: "0.1.0",
            host: env_or("HOST", "0.0.0.0"),
            port: env_or("PORT", "29070").parse().unwrap_or(29070),
            db_driver: env_or("DB_DRIVER", "postgres"),
            db_url: env::var("DB_URL").ok().filter(|v| !v.is_empty()),
            repo_root: env_or("REPO_ROOT", "../.."),
            jwt_secret: env_or("JWT_SECRET", "dev-secret-change-me"),
            access_token_ttl_seconds: env_or("ACCESS_TOKEN_TTL_SECONDS", "3600")
                .parse()
                .unwrap_or(3600),
            refresh_token_ttl_seconds: env_or("REFRESH_TOKEN_TTL_SECONDS", "604800")
                .parse()
                .unwrap_or(604_800),
            login_rate_limit_per_minute: env_or("LOGIN_RATE_LIMIT_PER_MINUTE", "10")
                .parse()
                .unwrap_or(10),
            llm: LlmConfig::from_environment(),
        }
    }

    pub fn is_sqlite(&self) -> bool {
        self.db_driver == "sqlite"
            || self.db_url.as_deref().is_some_and(|u| u.starts_with("sqlite"))
    }

    /// 仓库根的绝对路径（repo_root 可能是相对 CWD 的 `../..`）。
    pub fn abs_repo_root(&self) -> String {
        let p = PathBuf::from(&self.repo_root);
        std::fs::canonicalize(&p)
            .unwrap_or(p)
            .to_string_lossy()
            .into_owned()
    }
}

impl LlmConfig {
    pub fn from_environment() -> Self {
        LlmConfig {
            enabled: env_or("LLM_ENABLED", "false") == "true",
            provider: env_or("LLM_PROVIDER", "openai"),
            base_url: env_or("LLM_BASE_URL", "https://api.openai.com/v1"),
            api_key: env_or("LLM_API_KEY", ""),
            model: env_or("LLM_MODEL", "gpt-4.1-mini"),
            timeout_ms: env_or("LLM_TIMEOUT_MS", "30000").parse().unwrap_or(30_000),
            max_retries: env_or("LLM_MAX_RETRIES", "2").parse().unwrap_or(2),
            retry_backoff_ms: env_or("LLM_RETRY_BACKOFF_MS", "400").parse().unwrap_or(400),
            api_style: env_or("LLM_API_STYLE", "chat"),
            user_agent: env_or(
                "LLM_USER_AGENT",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
                 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            ),
        }
    }
}
