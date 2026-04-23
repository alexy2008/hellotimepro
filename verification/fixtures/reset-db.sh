#!/usr/bin/env bash
# reset-db.sh · 契约测试辅助（M0 占位）
#
# 作用：清空 hellotime_pro 数据库，并重新执行 spec/db/schema.sql。
# 适用：本地快速回归；CI 中请通过独立的 docker volume 达到同等隔离。
#
# 用法：
#   ./verification/fixtures/reset-db.sh                 # 默认连本地 compose 起的 PG
#   DB_URL=... ./verification/fixtures/reset-db.sh      # 指定连接串
#
# ⚠ 危险：会 DROP 所有表。
set -euo pipefail

: "${DB_URL:=postgres://hellotime:hellotime@127.0.0.1:55432/hellotime_pro}"

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA="$ROOT/spec/db/schema.sql"

if [[ ! -f "$SCHEMA" ]]; then
  echo "schema.sql 不存在：$SCHEMA" >&2
  exit 1
fi

echo "⚠ 即将清空数据库: $DB_URL"
if [[ -t 0 ]] && [[ -z "${FORCE:-}" ]]; then
  read -rp "输入 yes 继续: " ans
  [[ "$ans" == "yes" ]] || { echo "已取消。"; exit 0; }
fi

psql "$DB_URL" <<'SQL'
-- 清空并重建公共 schema（简单、彻底、避免列出所有表）
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL

psql "$DB_URL" -f "$SCHEMA"

echo "✓ 已重置并应用 schema.sql"
