#!/usr/bin/env bash
# verify-ui-smoke.sh · UI 冒烟测试
#
# 用法：
#   ./verification/scripts/verify-ui-smoke.sh react        # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh react-ts     # 目录别名，等同于 react
#   ./verification/scripts/verify-ui-smoke.sh vue          # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh vue3-ts      # 目录别名，等同于 vue
#   ./verification/scripts/verify-ui-smoke.sh angular
#   ./verification/scripts/verify-ui-smoke.sh svelte       # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh svelte-ts    # 目录别名（同 svelte）
#   ./verification/scripts/verify-ui-smoke.sh next         # 全栈同源实现（Next.js）
#   ./verification/scripts/verify-ui-smoke.sh nuxt         # 全栈同源实现（Nuxt 3）
#   ./verification/scripts/verify-ui-smoke.sh laravel      # 全栈同源实现（PHP）
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
  echo "  frontend 可选: react / react-ts / vue / vue3-ts / angular / svelte / svelte-ts / solid / solid-ts / next / nuxt / spring-mvc / rails / laravel" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
HELLO="$ROOT/scripts/hello"
UI_DIR="$ROOT/verification/ui"

# 别名映射：目录名 → hello list 登记名
case "$_RAW_TARGET" in
  react-ts)   TARGET="react" ;;
  vue3-ts)    TARGET="vue" ;;
  svelte-ts)  TARGET="svelte" ;;
  solid-ts)   TARGET="solid" ;;
  *)          TARGET="$_RAW_TARGET" ;;
esac

case "$TARGET" in
  react|vue|angular|svelte|solid|next|nuxt|spring-mvc|rails|laravel) ;;
  *)
    echo "✗ 暂不支持的前端: $_RAW_TARGET" >&2
    echo "  frontend 可选: react / react-ts / vue / vue3-ts / angular / svelte / svelte-ts / solid / solid-ts / next / nuxt / spring-mvc / rails / laravel" >&2
    exit 2
    ;;
esac

# 全栈同源实现集合（自带 API，不需要后端代理）
_is_fullstack() {
  case "$1" in
    next|nuxt|spring-mvc|rails|laravel) return 0 ;;
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

STACKS="$("$HELLO" list)"
FRONTEND_PORT="$(awk -v t="$TARGET" '$2==t {print $4}' <<< "$STACKS")"
if [[ -z "$FRONTEND_PORT" ]]; then
  echo "✗ 未登记的前端: $TARGET" >&2; exit 2
fi

BACKEND_PROXY_URL="${BACKEND_PROXY:-http://127.0.0.1:9080}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

source "$ROOT/verification/scripts/verification-db.sh"
if _is_fullstack "$TARGET"; then
  configure_verification_db "$TARGET"
else
  # 后端可能用临时 DB_DRIVER 启动；保存的默认驱动并不代表运行中的进程。
  runtime_driver="$(curl -fsS --max-time 5 "${BACKEND_PROXY_URL%/}/api/v1/health" | python3 -c '
import json, sys
items = json.load(sys.stdin)["data"]["stack"]["items"]
names = {"sqlite": "sqlite", "postgresql": "postgres", "postgres": "postgres"}
print(next((names.get(i["name"].lower(), "") for i in items if i["role"] == "database"), ""))
')"
  db_owner="@proxy"
  if [[ -z "${DB_URL:-}" ]]; then
    case "$BACKEND_PROXY_URL" in
      http://localhost:9080|http://localhost:9080/|http://127.0.0.1:9080|http://127.0.0.1:9080/) ;;
      *)
        db_owner=""
        if [[ "$BACKEND_PROXY_URL" =~ ^http://(localhost|127\.0\.0\.1):([0-9]+)/?$ ]]; then
          db_owner="$(awk -v p="${BASH_REMATCH[2]}" '($3=="backend" || $3=="fullstack") && $4==p {print $2}' <<< "$STACKS")"
        fi
        if [[ -z "$db_owner" ]]; then
          echo "无法从自定义 BACKEND_PROXY 定位本地数据库，请传入后端使用的 DB_URL" >&2
          exit 2
        fi
        ;;
    esac
  fi
  configure_verification_db "$db_owner" "$runtime_driver"
fi

# ── 生命周期 ─────────────────────────────────────────────────────────────────

cleanup() {
  "$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 先停掉旧实例
"$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true

# UI 验证入口负责显式准备 schema；后端 run 脚本只负责启动服务。
"$ROOT/scripts/db" init

# ── 启动前端（代理指向默认后端入口）──────────────────────────────────────────

if _is_fullstack "$TARGET"; then
  echo "→ 启动全栈 ${TARGET}（API + UI 同源）"
  "$HELLO" start "$TARGET"
else
  echo "→ 启动前端 ${TARGET}（默认后端入口 → ${BACKEND_PROXY_URL}）"
  BACKEND_PROXY="$BACKEND_PROXY_URL" "$HELLO" start "$TARGET"
fi

echo "→ 等待前端就绪…"
# JVM 全栈（spring-mvc）冷启动需先 mvn 编译再启动 Spring，耗时可达 ~60s；放宽到 120s。
# 循环命中即退出，对启动快的前端无影响。
_READY_TIMEOUT="${UI_READY_TIMEOUT:-120}"
for i in $(seq 1 "$_READY_TIMEOUT"); do
  if curl -fsS -o /dev/null "$FRONTEND_URL" 2>/dev/null; then
    echo "  ✓ $TARGET 已就绪（第 $i 次）"
    break
  fi
  [[ $i -eq $_READY_TIMEOUT ]] && { echo "✗ $TARGET 未在 ${_READY_TIMEOUT}s 内就绪" >&2; exit 1; }
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
"$ROOT/scripts/db" cleanup-ui

echo ""
if [[ $rc -eq 0 ]]; then
  echo "✅ UI 冒烟测试通过: $TARGET"
else
  echo "❌ UI 冒烟测试失败: $TARGET [exit=$rc]"
  echo "   HTML 报告: $UI_DIR/report/index.html"
fi
exit $rc
