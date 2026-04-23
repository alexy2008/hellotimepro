#!/usr/bin/env bash
# verify-design-tokens.sh · 设计令牌一致性（M0 占位）
#
# 检查 spec/styles/tokens.css 与 spec/tokens/tokens.json 是否同步，
# 以及各前端 /static/tokens.* 是否等值于 spec 中的版本。
#
# M0 占位。M1 实现：
#   - 解析 tokens.css 的 --var 与 tokens.json 的 flat key，diff 到 0
#   - 遍历 frontends/*, fullstacks/*，比对其 tokens 快照
set -euo pipefail
echo "🎨 设计令牌一致性（M0 占位）"
exit 0
