#!/usr/bin/env bash
# verify-contract.sh · 契约验证入口
#
# 用法：
#   ./verification/scripts/verify-contract.sh fastapi
#   DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
#
# 流程：
#   1. 从 data/.hello-state.json 读取 DB 配置（优先于环境变量硬编码值）
#   2. 清空 DB
#   3. ./scripts/hello start <target>（run 脚本自动跑 alembic + seed_demo.py）
#   4. 轮询 /api/v1/health，直到就绪或超时
#   5. BASE_URL=... node --test verification/contract
#   6. 清理测试创建的用户（@hellotime-contract.com）
#   7. hello stop <target>（trap 保证必停）
#
# 退出码：0 全绿；非 0 = 测试失败或启动失败。
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "用法: $0 <target>" >&2
  echo "  当前已实现: fastapi" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
HELLO="$ROOT/scripts/hello"

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

# --- 端口查找 -------------------------------------------------------------
PORT="$("$HELLO" list | awk -v t="$TARGET" '$2==t {print $4}')"
if [[ -z "$PORT" ]]; then
  echo "未登记的 target: $TARGET" >&2
  exit 2
fi
BASE_URL="http://127.0.0.1:${PORT}"

# --- 从 hello-state.json 加载 DB 配置 ------------------------------------
# 优先级：环境变量 > hello-state.json > 内置默认值
_STATE_FILE="$ROOT/data/.hello-state.json"

_read_state_cfg() {
  python3 - "$_STATE_FILE" <<'PYEOF'
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
  _cfg=()
  while IFS= read -r _line; do _cfg+=("$_line"); done < <(_read_state_cfg)
else
  _cfg=(postgres 127.0.0.1 5432 hellotime_pro hellotime hellotime data/sqlite/hellotime.db)
fi

_STATE_DRIVER="${_cfg[0]:-postgres}"
_PG_HOST="${_cfg[1]:-127.0.0.1}"
_PG_PORT="${_cfg[2]:-5432}"
_PG_DB="${_cfg[3]:-hellotime_pro}"
_PG_USER="${_cfg[4]:-hellotime}"
_PG_PASS="${_cfg[5]:-hellotime}"
_SQLITE_REL="${_cfg[6]:-data/sqlite/hellotime.db}"

# 环境变量优先覆盖
DB_DRIVER="${DB_DRIVER:-$_STATE_DRIVER}"
export DB_DRIVER

# 计算 SQLite 绝对路径
if [[ "$_SQLITE_REL" == /* ]]; then
  _SQLITE_ABS="$_SQLITE_REL"
else
  _SQLITE_ABS="$ROOT/$_SQLITE_REL"
fi

# 构建 DB_URL（若环境变量未设置）
if [[ -z "${DB_URL:-}" ]]; then
  if [[ "$DB_DRIVER" == "sqlite" ]]; then
    export DB_URL="sqlite:///$_SQLITE_ABS"
  else
    export DB_URL="postgresql+psycopg://$_PG_USER:$_PG_PASS@$_PG_HOST:$_PG_PORT/$_PG_DB"
  fi
fi

# --- reset_db -------------------------------------------------------------
reset_db() {
  if [[ "$DB_DRIVER" == "sqlite" ]]; then
    rm -f "$_SQLITE_ABS"
    mkdir -p "$(dirname "$_SQLITE_ABS")"
    echo "↻ SQLite 已重置: $_SQLITE_ABS"
  else
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
  fi
}

# --- cleanup_test_data ----------------------------------------------------
# 删除测试创建的用户（@hellotime-contract.com），CASCADE 清理其关联数据。
# 演示用户（@demo.hellotimepro.dev）保留不动。
cleanup_test_data() {
  echo "→ 清理测试数据（@hellotime-contract.com）…"
  if [[ "$DB_DRIVER" == "sqlite" ]]; then
    if command -v sqlite3 >/dev/null 2>&1 && [[ -f "$_SQLITE_ABS" ]]; then
      sqlite3 "$_SQLITE_ABS" \
        "DELETE FROM users WHERE email LIKE '%@hellotime-contract.com';" 2>/dev/null || true
      echo "✓ 测试数据已清理（SQLite）"
    fi
  else
    if command -v psql >/dev/null 2>&1; then
      PGPASSWORD="$_PG_PASS" psql \
        -h "$_PG_HOST" -p "$_PG_PORT" -U "$_PG_USER" -d "$_PG_DB" \
        -c "DELETE FROM users WHERE email LIKE '%@hellotime-contract.com';" \
        >/dev/null 2>&1 || true
      echo "✓ 测试数据已清理（Postgres）"
    fi
  fi
}

# --- 生命周期 -------------------------------------------------------------
cleanup() {
  "$HELLO" stop "$TARGET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_health() {
  local url="$BASE_URL/api/v1/health"
  for i in $(seq 1 60); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "✓ $TARGET 已就绪（$i 次轮询）"
      return 0
    fi
    sleep 1
  done
  echo "✗ $TARGET 未在 60s 内就绪" >&2
  echo "  查看日志: tail $ROOT/data/logs/$TARGET.log" >&2
  return 1
}

# --- 主流程 ---------------------------------------------------------------
echo "=== 契约验证 · $TARGET ($DB_DRIVER) ==="
echo "    DB: ${DB_URL//:*@/:***@}"    # 隐藏密码

# 若已在运行，先停掉，保证干净状态
"$HELLO" stop "$TARGET" >/dev/null 2>&1 || true

reset_db

"$HELLO" start "$TARGET"
wait_health

echo "→ 运行 node --test verification/contract"
BASE_URL="$BASE_URL" node --test "$ROOT"/verification/contract/*.spec.ts
rc=$?

# 无论测试成功与否，都清理测试数据（保留演示数据）
cleanup_test_data

echo
if [[ $rc -eq 0 ]]; then
  echo "✅ 契约验证通过: $TARGET ($DB_DRIVER)"
else
  echo "❌ 契约验证失败: $TARGET ($DB_DRIVER) [exit=$rc]"
fi
exit $rc
