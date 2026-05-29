"""应用配置：通过环境变量 / `.env` 读取。"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- 服务元数据 ---
    service_name: str = "hellotime-pro"
    service_version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 29010

    # --- 数据库 ---
    # 支持两种驱动；切换仅需改两个变量。
    db_driver: str = Field(default="postgres", pattern="^(postgres|sqlite)$")
    db_url: str = Field(
        default="postgresql+psycopg://hellotime:hellotime@127.0.0.1:5432/hellotime_pro"
    )

    # --- JWT / 密码 ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 3600
    refresh_token_ttl_seconds: int = 7 * 24 * 3600
    bcrypt_rounds: int = 10

    # --- 静态资源 ---
    # 头像 / 图标来源于 spec/，backend 启动时在内存里映射
    avatars_catalog_path: Path = REPO_ROOT / "spec" / "avatars" / "catalog.json"
    avatars_source_dir: Path = REPO_ROOT / "spec" / "avatars"
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
    # 调用风格：chat=只用 /chat/completions（默认，多数兼容网关只支持它）；
    # responses=只用 /responses；auto=先 responses 失败再回退 chat。可用 LLM_API_STYLE 覆盖。
    llm_api_style: str = "chat"
    # 部分网关（如 Cloudflare 后的代理）会封禁 urllib 默认 UA（error 1010），
    # 默认发送浏览器风格 User-Agent；可用环境变量 LLM_USER_AGENT 覆盖。
    llm_user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )


settings = Settings()
