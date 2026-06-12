use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::config::AppConfig;
use crate::infra::db::Db;
use crate::services::avatar::AvatarService;

/// 应用状态：手动装配（无 DI 容器），Arc<AppState> 注入 axum Router。
pub struct AppState {
    pub config: AppConfig,
    pub db: Db,
    pub avatars: AvatarService,
    pub rate_limiter: LoginRateLimiter,
    pub http: reqwest::Client,
    pub suggestion_template: String,
    pub recommendation_template: String,
    pub start_time: Instant,
}

impl AppState {
    pub fn build(config: AppConfig) -> Result<AppState, String> {
        let db = Db::connect(&config).map_err(|e| e.message.clone())?;
        let avatars = AvatarService::load(&config)?;
        let http = reqwest::Client::builder()
            .timeout(Duration::from_millis(config.llm.timeout_ms))
            .build()
            .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;
        let suggestion_template =
            load_template(&config, "spec/llm/capsule-suggestion.prompt.md");
        let recommendation_template =
            load_template(&config, "spec/llm/capsule-recommendation.prompt.md");
        Ok(AppState {
            rate_limiter: LoginRateLimiter::new(config.login_rate_limit_per_minute),
            config,
            db,
            avatars,
            http,
            suggestion_template,
            recommendation_template,
            start_time: Instant::now(),
        })
    }
}

/// 读取仓库内 prompt 模板（缺失则空串，使用各服务内置默认模板）。
fn load_template(config: &AppConfig, relative_path: &str) -> String {
    let path = format!("{}/{relative_path}", config.abs_repo_root());
    std::fs::read_to_string(path).unwrap_or_default()
}

/// 每邮箱失败次数滑动窗口（教学项目：进程内存实现，多 worker 下失效，见 docs/dev-notes.md §1）。
pub struct LoginRateLimiter {
    limit: usize,
    window: Duration,
    failures: Mutex<HashMap<String, Vec<Instant>>>,
}

impl LoginRateLimiter {
    pub fn new(limit: usize) -> Self {
        LoginRateLimiter {
            limit,
            window: Duration::from_secs(60),
            failures: Mutex::new(HashMap::new()),
        }
    }

    pub fn is_limited(&self, email: &str) -> bool {
        let cutoff = Instant::now() - self.window;
        let mut map = self.failures.lock().unwrap();
        let bucket = map.entry(email.to_string()).or_default();
        bucket.retain(|t| *t > cutoff);
        bucket.len() >= self.limit
    }

    pub fn record_failure(&self, email: &str) {
        let mut map = self.failures.lock().unwrap();
        map.entry(email.to_string()).or_default().push(Instant::now());
    }
}
