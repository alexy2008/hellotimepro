#!/usr/bin/env bash
# verify-ui-smoke.sh · UI 冒烟测试（M0 占位）
#
# 用法：
#   ./verification/scripts/verify-ui-smoke.sh <frontend>
#
# M1 版将使用 Playwright 跑一遍主流程：注册 → 创建 → 开启 → 收藏 → 广场可见。
# M0 只输出占位信息。
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "用法: $0 <frontend>" >&2
  echo "  frontend 可选: vue / react / angular / svelte / solid / next / nuxt / rails / laravel / spring-mvc" >&2
  exit 2
fi

echo "🎭 UI 冒烟测试（M0 占位）"
echo "    target = $TARGET"
echo "    tool   = Playwright（将在 M1 引入）"
exit 0
