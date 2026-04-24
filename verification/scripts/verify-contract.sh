#!/usr/bin/env bash
# verify-contract.sh · 契约验证入口
#
# 用法：
#   ./verification/scripts/verify-contract.sh fastapi
#   DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
#
# 流程：
#   1. 按 DB_DRIVER 清空 DB
#   2. ./scripts/hello start <target>（run 脚本会自动跑 alembic upgrade）
#   3. 轮询 /api/v1/health，直到就绪或超时
#   4. BASE_URL=... node --test verification/contract
#   5. hello stop <target>（trap 保证必停）
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

# --- 端口查找 -----------------------------------------------------------------
PORT="$("$HELLO" list | awk -v t="$TARGET" '$2==t {print $4}')"
if [[ -z "$PORT" ]]; then
  echo "未登记的 target: $TARGET" >&2
  exit 2
fi
BASE_URL="http://127.0.0.1:${PORT}"

# --- DB 驱动 -------------------------------------------------------------------
DB_DRIVER="${DB_DRIVER:-postgres}"
export DB_DRIVER

reset_db() {
  if [[ "$DB_DRIVER" == "sqlite" ]]; then
    SQLITE_PATH="${DB_URL:-sqlite:///$ROOT/data/sqlite/hellotime.db}"
    # 从 DB_URL 剥离前缀
    FILE="${SQLITE_PATH#sqlite:///}"
    rm -f "$FILE"
    mkdir -p "$(dirname "$FILE")"
    echo "↻ SQLite 已重置: $FILE"
  else
    if ! command -v psql >/dev/null 2>&1; then
      echo "需要 psql 才能重置 postgres 数据库" >&2
      exit 2
    fi
    # 解析 DB_URL（兼容 postgresql+psycopg:// 和 postgres:// 两种前缀）
    local raw_url="${DB_URL:-postgres://hellotime:hellotime@127.0.0.1:55432/hellotime_pro}"
    raw_url="${raw_url#postgresql+psycopg://}"
    raw_url="${raw_url#postgresql://}"
    raw_url="${raw_url#postgres://}"
    # raw_url 现在是 user:pass@host:port/db
    local pg_user; pg_user="${raw_url%%:*}"
    local after_user; after_user="${raw_url#*:}"
    local pg_pass; pg_pass="${after_user%%@*}"
    local after_pass; after_pass="${after_user#*@}"
    local pg_host; pg_host="${after_pass%%:*}"
    local after_host; after_host="${after_pass#*:}"
    local pg_port; pg_port="${after_host%%/*}"
    local pg_db; pg_db="${after_host#*/}"

    PGPASSWORD="$pg_pass" psql -h "$pg_host" -p "$pg_port" -U "$pg_user" -d "$pg_db" \
      -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL
    echo "↻ Postgres schema 已重置 ($pg_host:$pg_port/$pg_db)"
  fi
}

# --- 生命周期 -----------------------------------------------------------------
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

# --- 主流程 -------------------------------------------------------------------
echo "=== 契约验证 · $TARGET ($DB_DRIVER) ==="

# 若已在运行，先停掉，保证干净状态
"$HELLO" stop "$TARGET" >/dev/null 2>&1 || true

reset_db

"$HELLO" start "$TARGET"
wait_health

echo "→ 运行 node --test verification/contract"
BASE_URL="$BASE_URL" node --test "$ROOT"/verification/contract/*.spec.ts
rc=$?

echo
if [[ $rc -eq 0 ]]; then
  echo "✅ 契约验证通过: $TARGET ($DB_DRIVER)"
else
  echo "❌ 契约验证失败: $TARGET ($DB_DRIVER) [exit=$rc]"
fi
exit $rc
