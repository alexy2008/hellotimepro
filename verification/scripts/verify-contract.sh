#!/usr/bin/env bash
# verify-contract.sh · 契约验证入口
#
# 用法：
#   ./verification/scripts/verify-contract.sh fastapi
#   DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
#
# 流程：
#   1. 解析 DB_DRIVER / DB_URL，未设置时使用 data/.hello-state.json
#   2. ./scripts/db reset --seed 显式准备数据库
#   3. ./scripts/hello start <target>
#   4. 轮询 /api/v1/health，直到就绪或超时
#   5. BASE_URL=... node --test verification/contract
#   6. 清理测试创建的用户（@hellotime-contract.com）
#   7. 重注入演示数据（scripts/db seed --force）
#   8. hello stop <target>（trap 保证必停）
#
# 退出码：0 全绿；非 0 = 测试失败或启动失败。
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "用法: $0 <target>" >&2
  echo "  target 使用 scripts/hello list 中的后端或全栈登记名" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
HELLO="$ROOT/scripts/hello"
DBCTL="$ROOT/scripts/db"

# --- 端口查找 -------------------------------------------------------------
PORT="$("$HELLO" list | awk -v t="$TARGET" '$2==t {print $4}')"
if [[ -z "$PORT" ]]; then
  echo "未登记的 target: $TARGET" >&2
  exit 2
fi
BASE_URL="http://127.0.0.1:${PORT}"

source "$ROOT/verification/scripts/verification-db.sh"
configure_verification_db "$TARGET"

# --- reset_db -------------------------------------------------------------
reset_db() {
  "$DBCTL" reset --seed --yes
}

# --- seed_demo_data -------------------------------------------------------
# 将演示数据重新注入数据库（先删后插，保证幂等）。
# 演示账号域：@demo.hellotimepro.dev；密码：HelloTime2026!
seed_demo_data() {
  "$DBCTL" seed --force
}

# --- 生命周期 -------------------------------------------------------------
cleanup() {
  "$HELLO" stop "$TARGET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_health() {
  local url="$BASE_URL/api/v1/health"
  # 就绪等待秒数可用 READY_TIMEOUT 覆盖：next 等需要冷构建（next build 的类型检查+lint）
  # 的全栈首次启动可能超过默认 60s。
  local timeout="${READY_TIMEOUT:-60}"
  for i in $(seq 1 "$timeout"); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "✓ $TARGET 已就绪（$i 次轮询）"
      return 0
    fi
    sleep 1
  done
  echo "✗ $TARGET 未在 ${timeout}s 内就绪" >&2
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
set +e
BASE_URL="$BASE_URL" node --test "$ROOT"/verification/contract/*.spec.ts
rc=$?
set -e

# 无论测试成功与否，都清理测试数据并重注入演示数据
cleanup_rc=0
"$DBCTL" cleanup-contract || cleanup_rc=$?
seed_demo_data || cleanup_rc=$?
if [[ $rc -eq 0 ]]; then rc=$cleanup_rc; fi

echo
if [[ $rc -eq 0 ]]; then
  echo "✅ 契约验证通过: $TARGET ($DB_DRIVER)"
else
  echo "❌ 契约验证失败: $TARGET ($DB_DRIVER) [exit=$rc]"
fi
exit $rc
