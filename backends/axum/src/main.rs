use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

mod config;
mod domain;
mod infra;
mod services;
mod state;
mod web;

use config::AppConfig;
use state::AppState;

#[tokio::main]
async fn main() {
    // LLM 日志规范要求 INFO 级别可见；LOG_LEVEL 由 run 脚本默认 info。
    let level = std::env::var("LOG_LEVEL")
        .unwrap_or_else(|_| "info".to_string())
        .to_lowercase()
        .replace("warning", "warn");
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new(level))
        .init();

    let config = AppConfig::from_environment();
    let addr = format!("{}:{}", config.host, config.port);
    let driver = if config.is_sqlite() { "sqlite" } else { "postgres" };

    let state = match AppState::build(config) {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("启动失败: {e}");
            std::process::exit(1);
        }
    };

    let app = web::routes::router(state).layer(CorsLayer::permissive());

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("监听 {addr} 失败: {e}");
            std::process::exit(1);
        }
    };
    tracing::info!("hellotime-axum listening on {addr} (db={driver})");
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("服务异常退出: {e}");
        std::process::exit(1);
    }
}
