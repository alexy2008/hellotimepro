#!/usr/bin/env bash
# reset-db.sh · 兼容入口：清空数据库并重新应用 schema + 演示数据。
#
# 实际维护逻辑集中在 scripts/db；本脚本只保留旧路径兼容。
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

args=(reset --seed)
if [[ -n "${FORCE:-}" ]]; then
  args+=(--yes)
fi

exec "$ROOT/scripts/db" "${args[@]}"
