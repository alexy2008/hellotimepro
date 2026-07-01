#!/usr/bin/env bash
# 构建校验 HelloTime Pro · Flutter 桌面端：令牌 codegen + analyze + build macos。
# 注：Flutter 强制把产物写入 build/ 目录，与仓库惯例的 ./build 脚本同名冲突，故用 build.sh。
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

export PATH="$HOME/development/flutter/bin:$PATH"
export LANG="${LANG:-en_US.UTF-8}"

if ! command -v flutter >/dev/null 2>&1; then
  echo "需要 Flutter SDK（~/development/flutter/bin 不在 PATH）。" >&2
  exit 1
fi

echo "==> 令牌 codegen"
node ../../scripts/gen-tokens-flutter

echo "==> flutter pub get"
flutter pub get

echo "==> flutter analyze"
flutter analyze

echo "==> flutter build macos (debug)"
flutter build macos --debug

echo "✅ Flutter 桌面端构建校验通过"
