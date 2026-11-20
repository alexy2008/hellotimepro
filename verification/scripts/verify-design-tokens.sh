#!/usr/bin/env bash
# verify-design-tokens.sh · 设计令牌一致性（2.0）
#
# 用法：
#   ./verification/scripts/verify-design-tokens.sh            # 只查 spec：两套皮肤语义层同名同集合、skins.json 最新
#   ./verification/scripts/verify-design-tokens.sh react      # 再查实现自己的样式（可给多个；目录名或路径）
#
# 实现自己的样式只能用 base.css 刻度与语义令牌（或 --_ 局部变量），不得写色值字面量；
# 规则详见 docs/02-design.md §15.4，实现在 verify_design_tokens.py。
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$ROOT/verification/scripts/verify_design_tokens.py" "$@"
