#!/usr/bin/env bash
# verify-ui-smoke.sh · UI 冒烟测试
#
# 用法：
#   ./verification/scripts/verify-ui-smoke.sh react        # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh react-ts     # 目录别名，等同于 react
#   ./verification/scripts/verify-ui-smoke.sh vue          # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh vue3-ts      # 目录别名，等同于 vue
#   ./verification/scripts/verify-ui-smoke.sh angular
#   ./verification/scripts/verify-ui-smoke.sh next         # 全栈同源实现（Next.js）
#   ./verification/scripts/verify-ui-smoke.sh nuxt         # 全栈同源实现（Nuxt 3）
#
# 流程：
#   1. 启动前端或同源全栈实现（前端默认 BACKEND_PROXY=http://127.0.0.1:9080）
#   2. 等待 UI 健康
#   3. 运行 Playwright 冒烟测试
#   4. 清理测试创建的用户（@ui-smoke.hellotimepro.dev）
#   5. trap 保证 stop 前端
#
# 退出码：0 全绿；非 0 = 测试失败或启动失败。
set -euo pipefail

_RAW_TARGET="${1:-}"
if [[ -z "$_RAW_TARGET" ]]; then
  echo "用法: $0 <frontend>" >&2
  echo "  frontend 可选: react / react-ts / vue / vue3-ts / angular / next / nuxt" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
HELLO="$ROOT/scripts/hello"
UI_DIR="$ROOT/verification/ui"

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

# 别名映射：目录名 → hello list 登记名
case "$_RAW_TARGET" in
  react-ts) TARGET="react" ;;
  vue3-ts)  TARGET="vue" ;;
  *)        TARGET="$_RAW_TARGET" ;;
esac

case "$TARGET" in
  react|vue|angular|next|nuxt) ;;
  *)
    echo "✗ 暂不支持的前端: $_RAW_TARGET" >&2
    echo "  frontend 可选: react / react-ts / vue / vue3-ts / angular / next / nuxt" >&2
    exit 2
    ;;
esac

# 全栈同源实现集合（自带 API，不需要后端代理）
_is_fullstack() {
  case "$1" in
    next|nuxt) return 0 ;;
    *)        return 1 ;;
  esac
}

# ── 依赖检查 ─────────────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 需要 node" >&2; exit 2
fi

# 安装 verification/ui npm 依赖（首次或 node_modules 缺失时）
if [[ ! -d "$UI_DIR/node_modules" ]]; then
  echo "→ 安装 Playwright 依赖…"
  (cd "$UI_DIR" && npm install --silent)
  (cd "$UI_DIR" && npx playwright install chromium --with-deps 2>&1 | tail -5)
fi

# ── 前端与默认后端入口配置 ───────────────────────────────────────────────────

FRONTEND_PORT="$("$HELLO" list 2>/dev/null | awk -v t="$TARGET" '$2==t {print $4}')"
if [[ -z "$FRONTEND_PORT" ]]; then
  echo "✗ 未登记的前端: $TARGET" >&2; exit 2
fi

BACKEND_PROXY_URL="${BACKEND_PROXY:-http://127.0.0.1:9080}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

# ── DB 配置（用于测试数据清理）────────────────────────────────────────────────

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
print(d.get("proxy_target", ""))
PYEOF
}

if command -v python3 >/dev/null 2>&1; then
  _cfg=()
  while IFS= read -r _line; do _cfg+=("$_line"); done < <(_read_state_cfg)
else
  _cfg=(postgres 127.0.0.1 5432 hellotime_pro hellotime hellotime data/sqlite/hellotime.db "")
fi

_DB_DRIVER="${DB_DRIVER:-${_cfg[0]:-postgres}}"
_PG_HOST="${_cfg[1]:-127.0.0.1}"
_PG_PORT="${_cfg[2]:-5432}"
_PG_DB="${_cfg[3]:-hellotime_pro}"
_PG_USER="${_cfg[4]:-hellotime}"
_PG_PASS="${_cfg[5]:-hellotime}"
_SQLITE_BASE_REL="${_cfg[6]:-data/sqlite/hellotime.db}"
_PROXY_TARGET="${_cfg[7]:-}"

# 决定 SQLite 文件指向哪个 impl：
#   - 全栈（next/nuxt）：自己持有 SQLite → 用自身 target 名
#   - 前端（react/vue/angular）：API 走代理转发到后端 → 用 state.proxy_target
_SQLITE_OWNER="$TARGET"
if ! _is_fullstack "$TARGET"; then
  _SQLITE_OWNER="${_PROXY_TARGET:-fastapi}"
fi

# 派生 per-impl 路径（与 scripts/hello _sqlite_path_for / verify-contract 保持一致）
_sqlite_dir="${_SQLITE_BASE_REL%/*}"
_sqlite_file="${_SQLITE_BASE_REL##*/}"
if [[ "$_sqlite_file" == *.* ]]; then
  _sqlite_name="${_sqlite_file%.*}"
  _sqlite_ext="${_sqlite_file##*.}"
else
  _sqlite_name="$_sqlite_file"
  _sqlite_ext="db"
fi
if [[ "$_sqlite_dir" == "$_SQLITE_BASE_REL" ]]; then
  _SQLITE_REL="${_sqlite_name}-${_SQLITE_OWNER}.${_sqlite_ext}"
else
  _SQLITE_REL="${_sqlite_dir}/${_sqlite_name}-${_SQLITE_OWNER}.${_sqlite_ext}"
fi
[[ "$_SQLITE_REL" == /* ]] && _SQLITE_ABS="$_SQLITE_REL" || _SQLITE_ABS="$ROOT/$_SQLITE_REL"

# 若 DB_URL 已注入，从中解析出真实连接参数（用户/密码可能不同于 state 默认值）
if [[ -n "${DB_URL:-}" ]] && [[ "$_DB_DRIVER" == "postgres" ]] && command -v python3 >/dev/null 2>&1; then
  _url_parts=()
  while IFS= read -r _l; do _url_parts+=("$_l"); done < <(python3 - "$DB_URL" <<'PYEOF'
import re, sys
m = re.match(r'postgresql(?:\+\w+)?://([^:@]+):([^@]*)@([^:/]+):(\d+)/([^?]+)', sys.argv[1])
if m: print('\n'.join(m.groups()))
PYEOF
  )
  if [[ ${#_url_parts[@]} -eq 5 ]]; then
    _PG_USER="${_url_parts[0]}"
    _PG_PASS="${_url_parts[1]}"
    _PG_HOST="${_url_parts[2]}"
    _PG_PORT="${_url_parts[3]}"
    _PG_DB="${_url_parts[4]}"
  fi
fi

# ── cleanup_smoke_data ────────────────────────────────────────────────────────
# 删除 Playwright 冒烟测试创建的用户（@ui-smoke.hellotimepro.dev），CASCADE 清理关联数据。
cleanup_smoke_data() {
  echo "→ 清理 UI 冒烟测试数据（@ui-smoke.hellotimepro.dev）…"
  if [[ "$_DB_DRIVER" == "sqlite" ]]; then
    if command -v sqlite3 >/dev/null 2>&1 && [[ -f "$_SQLITE_ABS" ]]; then
      sqlite3 "$_SQLITE_ABS" \
        "DELETE FROM users WHERE email LIKE '%@ui-smoke.hellotimepro.dev';" 2>/dev/null || true
      echo "✓ 冒烟测试数据已清理（SQLite）"
    fi
  else
    if command -v psql >/dev/null 2>&1; then
      PGPASSWORD="$_PG_PASS" psql \
        -h "$_PG_HOST" -p "$_PG_PORT" -U "$_PG_USER" -d "$_PG_DB" \
        -c "DELETE FROM users WHERE email LIKE '%@ui-smoke.hellotimepro.dev';" \
        >/dev/null 2>&1 || true
      echo "✓ 冒烟测试数据已清理（Postgres）"
    else
      echo "⚠ psql 不可用，跳过冒烟测试数据清理"
    fi
  fi
}

# ── 生命周期 ─────────────────────────────────────────────────────────────────

cleanup() {
  "$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 先停掉旧实例
"$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true

# ── 启动前端（代理指向默认后端入口）──────────────────────────────────────────

if _is_fullstack "$TARGET"; then
  echo "→ 启动全栈 ${TARGET}（API + UI 同源）"
  "$HELLO" start "$TARGET"
else
  echo "→ 启动前端 ${TARGET}（默认后端入口 → ${BACKEND_PROXY_URL}）"
  BACKEND_PROXY="$BACKEND_PROXY_URL" "$HELLO" start "$TARGET"
fi

echo "→ 等待前端就绪…"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$FRONTEND_URL" 2>/dev/null; then
    echo "  ✓ $TARGET 已就绪（第 $i 次）"
    break
  fi
  [[ $i -eq 30 ]] && { echo "✗ $TARGET 未在 30s 内就绪" >&2; exit 1; }
  sleep 1
done

# ── 运行 Playwright ───────────────────────────────────────────────────────────

echo ""
echo "=== UI 冒烟测试 · $TARGET ==="
echo "    FRONTEND_URL = $FRONTEND_URL"
echo "    BACKEND_PROXY = $BACKEND_PROXY_URL"
echo ""

set +e
FRONTEND_TARGET="$TARGET" FRONTEND_URL="$FRONTEND_URL" npx --prefix "$UI_DIR" playwright test \
  --config "$UI_DIR/playwright.config.ts"
rc=$?
set -e

# 无论测试成功与否，都清理测试数据
cleanup_smoke_data

echo ""
if [[ $rc -eq 0 ]]; then
  echo "✅ UI 冒烟测试通过: $TARGET"
else
  echo "❌ UI 冒烟测试失败: $TARGET [exit=$rc]"
  echo "   HTML 报告: $UI_DIR/report/index.html"
fi
exit $rc
