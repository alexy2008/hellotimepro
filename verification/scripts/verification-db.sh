# 两个验证入口均在这里确定数据库，并向所有子进程导出同一组参数。
# 第一个参数是服务名；SPA 使用代理后端作为 SQLite 文件的所有者。
configure_verification_db() {
  local config
  config="$(python3 - "$ROOT" "$1" "${2:-}" <<'PY'
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

root = Path(sys.argv[1])
target, runtime_driver = sys.argv[2:]
state_path = root / "data/.hello-state.json"
state = json.loads(state_path.read_text()) if state_path.exists() else {}
config = state.get("db_config", {})
url = os.environ.get("DB_URL")
driver = os.environ.get("DB_DRIVER")
if target == "@proxy" and not (driver or url or runtime_driver):
    sys.exit("代理后端未公布数据库驱动，请提供后端使用的 DB_DRIVER 或 DB_URL")
if not driver:
    if url:
        driver = "sqlite" if url.startswith("sqlite:") else "postgres"
    else:
        driver = runtime_driver or state.get("db_driver", "postgres")
if runtime_driver and driver != runtime_driver:
    sys.exit("UI 验证配置与代理后端 /health 公布的数据库驱动不同，请检查 DB_DRIVER 和 DB_URL")
if not url:
    if driver == "sqlite":
        owner = (state.get("proxy_target") or "fastapi") if target == "@proxy" else target
        base = Path(config.get("sqlite_path", "data/sqlite/hellotime.db"))
        path = base.with_name(f"{base.stem}-{owner}{base.suffix}")
        url = f"sqlite:///{root / path}"
    else:
        user = quote(config.get("pg_user", "hellotime"), safe="")
        password = quote(config.get("pg_pass", "hellotime"), safe="")
        host = config.get("pg_host", "127.0.0.1")
        port = config.get("pg_port", 5432)
        database = quote(config.get("pg_db", "hellotime_pro"), safe="")
        url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
if driver == "sqlite":
    prefix = "sqlite:///"
    if not url.startswith(prefix) or url[len(prefix):] in ("", ":memory:"):
        sys.exit("SQLite 验证需要文件型 DB_URL")
    if "?" in url:
        sys.exit("验证脚本与 db reset 需要普通 SQLite 文件路径，不支持 URL 查询参数")
    url = prefix + str((root / url[len(prefix):]).resolve())
elif driver != "postgres" or not url.startswith(("postgresql://", "postgresql+psycopg://", "postgres://")):
    sys.exit("DB_DRIVER 和 DB_URL 的数据库类型不匹配")
print(driver)
print(url)
PY
)" || return 1
  DB_DRIVER="${config%%$'\n'*}"
  DB_URL="${config#*$'\n'}"
  export DB_DRIVER DB_URL
}
