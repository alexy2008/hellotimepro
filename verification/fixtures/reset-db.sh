#!/usr/bin/env bash
# reset-db.sh · 清空数据库并重新应用 schema + 演示数据
#
# 连接配置优先级：
#   1. 环境变量 DB_DRIVER / DB_URL
#   2. data/.hello-state.json（hello webui 写入的运行时配置）
#   3. 代码内置默认值
#
# 支持 PostgreSQL 和 SQLite。
#
# 用法：
#   ./verification/fixtures/reset-db.sh              # 从 hello-state.json 读配置
#   DB_DRIVER=sqlite ./verification/fixtures/reset-db.sh
#   DB_URL=postgres://... ./verification/fixtures/reset-db.sh
#
# ⚠ 危险：会 DROP 所有表。
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$ROOT/data/.hello-state.json"
SCHEMA="$ROOT/spec/db/schema.sql"
SEED_SCRIPT="$ROOT/spec/db/seed_demo.py"
FASTAPI_DIR="$ROOT/backends/fastapi"

# 自动将常见 Homebrew libpq 路径加入 PATH（macOS 本地开发）
for _pg_bin in \
  /opt/homebrew/Cellar/libpq/*/bin \
  /opt/homebrew/opt/libpq/bin \
  /opt/homebrew/opt/postgresql@*/bin \
  /usr/local/opt/libpq/bin \
  /usr/local/opt/postgresql@*/bin; do
  # shellcheck disable=SC2231
  [[ -d "$_pg_bin" ]] && export PATH="$_pg_bin:$PATH" && break
done

# --- 从 hello-state.json 读取 DB 配置 ------------------------------------
_read_state() {
  python3 - "$STATE_FILE" <<'PYEOF'
import json, sys, os
path = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    d = json.load(open(path)) if path and os.path.exists(path) else {}
except Exception:
    d = {}
cfg = d.get("db_config", {})
print(d.get("db_driver", "postgres"))
print(cfg.get("pg_host", "127.0.0.1"))
print(str(cfg.get("pg_port", 5432)))
print(cfg.get("pg_db",   "hellotime_pro"))
print(cfg.get("pg_user", "hellotime"))
print(cfg.get("pg_pass", "hellotime"))
print(cfg.get("sqlite_path", "data/sqlite/hellotime.db"))
PYEOF
}

if command -v python3 >/dev/null 2>&1; then
  _state_lines=()
  while IFS= read -r _line; do _state_lines+=("$_line"); done < <(_read_state)
else
  _state_lines=(postgres 127.0.0.1 5432 hellotime_pro hellotime hellotime data/sqlite/hellotime.db)
fi

_STATE_DRIVER="${_state_lines[0]:-postgres}"
_PG_HOST="${_state_lines[1]:-127.0.0.1}"
_PG_PORT="${_state_lines[2]:-5432}"
_PG_DB="${_state_lines[3]:-hellotime_pro}"
_PG_USER="${_state_lines[4]:-hellotime}"
_PG_PASS="${_state_lines[5]:-hellotime}"
_SQLITE_REL="${_state_lines[6]:-data/sqlite/hellotime.db}"

# 环境变量优先
DB_DRIVER="${DB_DRIVER:-$_STATE_DRIVER}"

if [[ -z "${DB_URL:-}" ]]; then
  if [[ "$DB_DRIVER" == "sqlite" ]]; then
    if [[ "$_SQLITE_REL" == /* ]]; then
      _SQLITE_ABS="$_SQLITE_REL"
    else
      _SQLITE_ABS="$ROOT/$_SQLITE_REL"
    fi
    DB_URL="sqlite:///$_SQLITE_ABS"
  else
    DB_URL="postgres://$_PG_USER:$_PG_PASS@$_PG_HOST:$_PG_PORT/$_PG_DB"
  fi
fi

# --- 确认 -----------------------------------------------------------------
echo "⚠  即将清空数据库 [$DB_DRIVER]"
if [[ -t 0 ]] && [[ -z "${FORCE:-}" ]]; then
  read -rp "输入 yes 继续: " ans
  [[ "$ans" == "yes" ]] || { echo "已取消。"; exit 0; }
fi

# --- 执行重置 -------------------------------------------------------------
if [[ "$DB_DRIVER" == "sqlite" ]]; then
  _FILE="${DB_URL#sqlite:///}"
  rm -f "$_FILE"
  mkdir -p "$(dirname "$_FILE")"
  echo "↻ SQLite 已删除: $_FILE"
  echo "  （启动后 alembic 将自动重建 schema，seed_demo.py 将注入演示数据）"

else
  # PostgreSQL
  if [[ ! -f "$SCHEMA" ]]; then
    echo "schema.sql 不存在：$SCHEMA" >&2
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "需要 psql 才能重置 postgres 数据库" >&2
    exit 2
  fi

  PGPASSWORD="$_PG_PASS" psql \
    -h "$_PG_HOST" -p "$_PG_PORT" -U "$_PG_USER" -d "$_PG_DB" \
    -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL
  echo "↻ Postgres schema 已重置 ($_PG_HOST:$_PG_PORT/$_PG_DB)"

  PGPASSWORD="$_PG_PASS" psql \
    -h "$_PG_HOST" -p "$_PG_PORT" -U "$_PG_USER" -d "$_PG_DB" \
    -f "$SCHEMA"
  echo "✓ 已应用 schema.sql"

  # 注入演示数据（需要 fastapi venv 中的依赖）
  if [[ -f "$SEED_SCRIPT" ]] && [[ -d "$FASTAPI_DIR" ]] && command -v uv >/dev/null 2>&1; then
    echo "→ 注入演示数据…"
    _pg_url="postgresql+psycopg://$_PG_USER:$_PG_PASS@$_PG_HOST:$_PG_PORT/$_PG_DB"
    (cd "$FASTAPI_DIR" && DB_DRIVER=postgres DB_URL="$_pg_url" uv run python "$SEED_SCRIPT")
  fi
fi

echo "✓ 数据库重置完成"
