#!/usr/bin/env bash
# verify-ui-smoke.sh · UI 冒烟测试
#
# 用法：
#   ./verification/scripts/verify-ui-smoke.sh react        # hello list 登记名
#   ./verification/scripts/verify-ui-smoke.sh react-ts     # 目录别名，等同于 react
#   BACKEND=fastapi ./verification/scripts/verify-ui-smoke.sh react
#
# 流程：
#   1. 启动后端（默认 fastapi，可通过 BACKEND= 覆盖）
#   2. 以 BACKEND_PROXY=http://localhost:<port> 启动前端
#   3. 等待前后端健康
#   4. 运行 Playwright 冒烟测试
#   5. trap 保证 stop
#
# 退出码：0 全绿；非 0 = 测试失败或启动失败。
set -euo pipefail

_RAW_TARGET="${1:-}"
if [[ -z "$_RAW_TARGET" ]]; then
  echo "用法: $0 <frontend>" >&2
  echo "  frontend 可选: react / react-ts  (其余前端暂无 Playwright 测试)" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
HELLO="$ROOT/scripts/hello"
UI_DIR="$ROOT/verification/ui"

# 别名映射：目录名 → hello list 登记名
case "$_RAW_TARGET" in
  react-ts) TARGET="react" ;;
  *)        TARGET="$_RAW_TARGET" ;;
esac

# 目前仅 react 实现了 Playwright 测试
if [[ "$TARGET" != "react" ]]; then
  echo "⚠️  $TARGET 暂无 Playwright 冒烟测试（仅 react/react-ts 已实现）"
  exit 0
fi

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

# ── 端口配置 ─────────────────────────────────────────────────────────────────

BACKEND="${BACKEND:-fastapi}"
BACKEND_PORT="$("$HELLO" list 2>/dev/null | awk -v t="$BACKEND" '$2==t {print $4}')"
if [[ -z "$BACKEND_PORT" ]]; then
  echo "✗ 未登记的后端: $BACKEND" >&2; exit 2
fi

FRONTEND_PORT="$("$HELLO" list 2>/dev/null | awk -v t="$TARGET" '$2==t {print $4}')"
if [[ -z "$FRONTEND_PORT" ]]; then
  echo "✗ 未登记的前端: $TARGET" >&2; exit 2
fi

BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

# ── 生命周期 ─────────────────────────────────────────────────────────────────

cleanup() {
  "$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true
  "$HELLO" stop "$BACKEND" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 先停掉旧实例
"$HELLO" stop "$TARGET"  >/dev/null 2>&1 || true
"$HELLO" stop "$BACKEND" >/dev/null 2>&1 || true

# ── 启动后端 ─────────────────────────────────────────────────────────────────

echo "→ 启动后端 ${BACKEND}（端口 ${BACKEND_PORT}）"
"$HELLO" start "$BACKEND"

echo "→ 等待后端就绪…"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "$BACKEND_URL/api/v1/health" 2>/dev/null; then
    echo "  ✓ $BACKEND 已就绪（第 $i 次）"
    break
  fi
  [[ $i -eq 60 ]] && { echo "✗ $BACKEND 未在 60s 内就绪" >&2; exit 1; }
  sleep 1
done

# ── 启动前端（代理指向该后端）────────────────────────────────────────────────

echo "→ 启动前端 ${TARGET}（代理 → ${BACKEND_URL}）"
BACKEND_PROXY="$BACKEND_URL" "$HELLO" start "$TARGET"

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
echo "=== UI 冒烟测试 · $TARGET → $BACKEND ==="
echo "    FRONTEND_URL = $FRONTEND_URL"
echo ""

FRONTEND_URL="$FRONTEND_URL" npx --prefix "$UI_DIR" playwright test \
  --config "$UI_DIR/playwright.config.ts"
rc=$?

echo ""
if [[ $rc -eq 0 ]]; then
  echo "✅ UI 冒烟测试通过: $TARGET"
else
  echo "❌ UI 冒烟测试失败: $TARGET [exit=$rc]"
  echo "   HTML 报告: $UI_DIR/report/index.html"
fi
exit $rc
