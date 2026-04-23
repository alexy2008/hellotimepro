#!/usr/bin/env bash
# verify-contract.sh · 契约验证脚本（M0 占位）
#
# 用法：
#   ./verification/scripts/verify-contract.sh <target>
#   例: ./verification/scripts/verify-contract.sh fastapi
#
# M1 版将完成以下流程（docs/02-design.md §15.2）：
#   1. ./scripts/hello start <target>，等健康检查（轮询 /health）
#   2. ./verification/fixtures/reset-db.sh
#   3. 运行 node --test verification/contract
#   4. 汇总报告（pass / fail / skip）
#   5. ./scripts/hello stop <target>
#
# M0 只输出占位信息。
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "用法: $0 <target>" >&2
  echo "  target 可选: fastapi / spring / gin / elysia / nest / aspnet / vapor / axum / drogon / ktor / next / nuxt / spring-mvc / rails / laravel" >&2
  exit 2
fi

echo "🏗  契约验证（M0 占位，尚未可执行）"
echo "    target = $TARGET"
echo "    spec   = spec/api/openapi.yaml"
echo "    用例   = verification/contract/*.spec.ts"
echo
echo "完整实现请等待 M1 参考栈落地。"
exit 0
