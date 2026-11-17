"""应用配置：通过环境变量 / `.env` 读取。"""

from __future__ import annotations

import uuid
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- 服务元数据 ---
    service_name: str = "hellotime-pro"
    service_version: str = "2.0.0"
    host: str = "0.0.0.0"
    port: int = 29010

    # --- 日志 ---
    # 应用自身（app.* 命名空间）的日志级别；可用 LOG_LEVEL 覆盖。
    # 注意：uvicorn 默认不给 root 配 handler，INFO 会被吞，必须显式配置（见 main.py）。
    log_level: str = "INFO"

    # --- 数据库 ---
    # 支持两种驱动；切换仅需改两个变量。
    db_driver: str = Field(default="postgres", pattern="^(postgres|sqlite)$")
    db_url: str = Field(
        default="postgresql+psycopg://hellotime:hellotime@127.0.0.1:5432/hellotime_pro"
    )

    # --- JWT / 密码 ---
    jwt_secret: str = "dev-secret-change-me-in-production-env"
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 3600
    refresh_token_ttl_seconds: int = 7 * 24 * 3600
    bcrypt_rounds: int = 10

    # --- 静态资源 ---
    # 头像 / 图标来源于 spec/，backend 启动时在内存里映射
    avatars_catalog_path: Path = REPO_ROOT / "spec" / "avatars" / "v2" / "catalog.json"
    avatars_source_dir: Path = REPO_ROOT / "spec" / "avatars" / "v2"
    icons_source_dir: Path = REPO_ROOT / "spec" / "icons"

    # --- 限流 ---
    login_rate_limit_per_minute: int = 10

    # --- 大模型叙述生成 ---
    llm_enabled: bool = False
    llm_provider: str = "openai"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4.1-mini"
    llm_timeout_ms: int = 30000
    # 瞬时网络/TLS 错误（如 SSL UNEXPECTED_EOF、连接被代理掐断）的额外重试次数；
    # 某些兼容网关会随机断流，重试能显著提升成功率。HTTP 4xx/5xx 等明确响应不重试。
    llm_max_retries: int = 2
    llm_retry_backoff_ms: int = 400
    # 调用风格：chat=只用 /chat/completions（默认，多数兼容网关只支持它）；
    # responses=只用 /responses；auto=先 responses 失败再回退 chat。可用 LLM_API_STYLE 覆盖。
    llm_api_style: str = "chat"
    # 以应用自身名义标识客户端（OpenCode Go 要求；HTTP 库默认 UA 会被 Cloudflare 1010 封禁）。
    # hello 从 Web UI 配置注入 LLM_USER_AGENT。
    llm_user_agent: str = "hellotimepro"
    # 发往 x-opencode-session 的会话 ID：进程内稳定，便于网关路由与 prompt 缓存；可用 LLM_SESSION_ID 覆盖。
    llm_session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


settings = Settings()
