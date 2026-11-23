#!/usr/bin/env bash
# 同步前端静态资源：Alpine.js、@fontsource 自托管字体、spec/styles 2.0（原样拷贝）、spec/avatars/v2。
set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$APP_DIR/../.." && pwd)"

cd "$APP_DIR"

mkdir -p public/js public/css public/styles/paper public/styles/amber public/static/avatars public/fonts

# 1. Alpine.js 本地拷贝（不依赖外网 CDN）
cp node_modules/alpinejs/dist/cdn.min.js public/js/alpine.min.js

# 2. 原样拷贝 spec/styles 2.0（verify-design-tokens.sh 校验字节级一致）
cp "$ROOT/spec/styles/base.css" public/styles/base.css
cp "$ROOT/spec/styles/shell.css" public/styles/shell.css
cp "$ROOT/spec/styles/paper/tokens.css" public/styles/paper/tokens.css
cp "$ROOT/spec/styles/paper/components.css" public/styles/paper/components.css
cp "$ROOT/spec/styles/paper/pages.css" public/styles/paper/pages.css
cp "$ROOT/spec/styles/amber/tokens.css" public/styles/amber/tokens.css
cp "$ROOT/spec/styles/amber/components.css" public/styles/amber/components.css
cp "$ROOT/spec/styles/amber/pages.css" public/styles/amber/pages.css

# 3. 同步 2.0 头像 SVG
rm -f public/static/avatars/*.svg
cp "$ROOT"/spec/avatars/v2/*.svg public/static/avatars/

# 4. 同步 @fontsource 自托管字体（时笺字体，不依赖外网 CDN）
rm -rf public/fonts/noto-serif-sc public/fonts/cormorant-garamond public/fonts/ibm-plex-mono
mkdir -p public/fonts/noto-serif-sc public/fonts/cormorant-garamond public/fonts/ibm-plex-mono

cp node_modules/@fontsource/noto-serif-sc/400.css \
   node_modules/@fontsource/noto-serif-sc/500.css \
   node_modules/@fontsource/noto-serif-sc/700.css \
   node_modules/@fontsource/noto-serif-sc/900.css \
   public/fonts/noto-serif-sc/
cp -R node_modules/@fontsource/noto-serif-sc/files public/fonts/noto-serif-sc/

cp node_modules/@fontsource/cormorant-garamond/400.css \
   node_modules/@fontsource/cormorant-garamond/500.css \
   node_modules/@fontsource/cormorant-garamond/600.css \
   node_modules/@fontsource/cormorant-garamond/400-italic.css \
   node_modules/@fontsource/cormorant-garamond/500-italic.css \
   public/fonts/cormorant-garamond/
cp -R node_modules/@fontsource/cormorant-garamond/files public/fonts/cormorant-garamond/

cp node_modules/@fontsource/ibm-plex-mono/400.css \
   node_modules/@fontsource/ibm-plex-mono/500.css \
   public/fonts/ibm-plex-mono/
cp -R node_modules/@fontsource/ibm-plex-mono/files public/fonts/ibm-plex-mono/
