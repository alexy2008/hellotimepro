# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HelloTime Pro** is a multi-stack teaching project: the same time-capsule web app implemented across 10 backends, 5 frontends, and 5 full-stacks. All implementations share a single API contract and design system defined in `spec/`. **M0–M3 are complete**: all 20 implementations are built and verified (dual-driver contract 104/104 + UI smoke 25/25). Current work is M4 — cross-stack comparison docs, polish, and v1.0 release.

## Commands

Each implementation has its own `./run`, `./build`, and `./test` scripts. Use the top-level dev manager for orchestration:

> **例外**：`desktop/flutter` 的构建脚本名为 `build.sh`（不是 `build`）。Flutter 工具链硬性把产物写入项目内的 `build/` **目录**，与同名脚本文件在文件系统层面冲突，无法并存，故让出 `build` 名。其余实现一律 `./build`。

```bash
./scripts/hello start <name>        # e.g. fastapi, react-ts, nextjs
./scripts/hello stop <name>
./scripts/hello status
./scripts/hello switch <backend>    # point :9080 proxy to a backend
./scripts/hello doctor              # check environment dependencies
./scripts/hello logs <name>
./scripts/hello restart-all

# Database maintenance is explicit and implementation-agnostic.
# Backend run scripts only start services.
./scripts/db status
./scripts/db init
./scripts/db reset --seed
./scripts/db seed --force

# PostgreSQL is managed locally and configured through the Web UI / data/.hello-state.json.
# Use that configuration for Postgres work; do not probe or start Docker unless explicitly asked.

# Verification
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-ui-smoke.sh react-ts

# Full-stack contract verification
./verification/scripts/verify-contract.sh <next|nuxt>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <next|nuxt>
```

### Verification Notes

- Backend/full-stack contract verification currently covers 104 black-box API cases, including AI capsule suggestion and recommendation endpoints.
- UI smoke verification currently covers 25 Playwright cases across auth, capsule creation/opening, plaza search/favorites, profile, protected routes, public pages, and AI creation helpers.
- `./verification/scripts/verify-contract.sh <target>` applies to backends and full-stacks as long as the target is registered in `hello list` and exposes `/api/v1/*` on its own port.
- `./verification/scripts/verify-ui-smoke.sh <react|vue|angular|svelte|solid|next|nuxt|spring-mvc|rails|laravel>` explicitly runs `./scripts/db init` before starting the target; it does not reset or seed data. JVM full-stacks cold-start slowly, so the readiness wait is 120s (override with `UI_READY_TIMEOUT`).
- Latest full-stack contract run on 2026-06-04 passed: next/nuxt PostgreSQL & SQLite 104/104, spring-mvc PostgreSQL 104/104, spring-mvc SQLite 104/104.
- Latest rails full-stack run on 2026-06-06 passed: contract PostgreSQL & SQLite 104/104; UI smoke PostgreSQL & SQLite 25/25.
- Latest ktor backend contract run on 2026-06-05 passed: PostgreSQL & SQLite 104/104.
- Latest aspnet backend contract run on 2026-06-06 passed: PostgreSQL & SQLite 104/104.
- Latest vapor backend contract run on 2026-06-12 passed: PostgreSQL & SQLite 104/104.
- Latest axum backend contract run on 2026-06-12 passed: PostgreSQL & SQLite 104/104.
- Latest drogon backend contract run on 2026-06-13 passed: PostgreSQL & SQLite 104/104.
- Latest UI smoke run on 2026-06-04 passed: react-ts 25/25, vue3-ts 25/25, svelte 25/25, angular 25/25, solid 25/25, next 25/25, nuxt 25/25, spring-mvc 25/25 (PostgreSQL & SQLite).
- Latest rails UI smoke run on 2026-06-06 passed: 25/25 (PostgreSQL & SQLite).
- Latest laravel full-stack contract run on 2026-06-10 passed: PostgreSQL & SQLite 104/104 (after the Eloquent ORM refactor).
- Latest laravel UI smoke run on 2026-06-11 passed: SQLite 25/25.
- Desktop clients (M5): 5 个实现,两类范式。**Web 壳**:`electron`(7190,自带 Chromium + Node)与 `tauri`(7191,系统 WebView + Rust)各内嵌 React/Svelte 前端,`./run` 拉 Vite dev server(探端口判活)。**纯原生**(`port: None` → `hello status` 显示 `native`,以进程存活判活,直连 `:9080`):`swiftui`(SwiftPM,@Observable,macOS 系统原生)、`flutter`(Dart + Skia/Impeller 自绘,Riverpod + go_router,令牌 codegen→`tokens.dart`)、`qt-pyside`(QML 视图 + Python 逻辑,QObject store 经 context property 暴露,令牌 codegen→`palette.py`)。原生窗口在 Playwright 之外——以编译 + 后端日志连通(app 请求出现在后端日志)佐证。各端 `./run`/`./build`(flutter 例外为 `build.sh`)。详见 `desktop/*/README.md` 与 `desktop/*/TECHNICAL_GUIDE.md`。
- Mobile clients (M5): 3 个已落地。`ios`(SwiftUI 原生,`port: None` → `native`)与 `desktop/swiftui` 共享逻辑层(Models/APIClient/AppStore/DateUtil 拷贝改写),视图层按移动 IA 重建——底部 Tab Bar(广场/开启/创建/我的)+ NavigationStack。XcodeGen 工程(`project.yml`→`.xcodeproj`),SVGView 渲染头像(UIImage 不认 SVG),Info.plist 开 ATS 本地 HTTP 例外。`./run` 走 xcodegen+xcodebuild+simctl 启模拟器(前台附着判活),`./build` 仅编译。验证:`hello start ios` 后端日志出现 plaza/avatars 200。详见 `mobile/ios/{README,TECHNICAL_GUIDE}.md`。
- Mobile clients (M5): `flutter-mobile`(`port: None` → `native`) 演示**一码多端**——与 `desktop/flutter` 是**同一份工程**(物理 `lib/` 唯一在 `desktop/flutter`;`mobile/flutter` 只提供移动运行入口 `run`/`build` + 文档,`./run` = `flutter run -d iOS 模拟器`,cd 到同源工程执行)。`hello` 里 `flutter`(desktop,`-d macos`)与 `flutter-mobile`(mobile,`-d ios`)是同一工程的两个运行目标,`lib/` 不复制。**go_router 路由树未因移动端重构**,移动 IA 全部由外壳层 `MediaQuery` 宽窄分支实现(`kWideBreakpoint=740`,窄屏走新增 `MobileShell`:精简顶部 bar + 底部 `NavigationBar`;宽屏保持顶部 nav+Footer),桌面零回归。iOS 加 ATS 本地明文例外;`flutter_svg` 遇 `<filter>` 打印良性警告。iOS ✅ 已验证(`hello start flutter-mobile` 后端日志出现 plaza/avatars/health 200);Android 脚手架已就位但本机无 Android SDK,`flutter build apk` 待 SDK。详见 `mobile/flutter/{README,TECHNICAL_GUIDE}.md`。
- Mobile clients (M5): `react-native`(7192, Expo + Metro) is the first mobile impl — "Web React vs Native React" vs `frontends/react-ts` (same zustand stores / api client / types ported near-verbatim; only the view layer rebuilt with native components + a bottom Tab Bar). Design tokens are codegen'd from `spec/tokens/tokens.json` → `src/theme/tokens.ts` via `scripts/gen-tokens-rn` (first real run of the M5.1 token pipeline). RN connects directly to `:9080` (`EXPO_PUBLIC_API_BASE` overrides; no proxy). Verified 2026-06-23: `./build` green (codegen + `tsc --noEmit` + `expo export --platform ios`), `hello start react-native` → Metro ready on :7192 → clean stop. Core-journey E2E is Maestro (`mobile/react-native/.maestro/core-journey.yaml`, testIDs in place); device run pending the iOS simulator runtime (`xcodebuild -downloadPlatform iOS`, ~7GB) + Maestro CLI. See `mobile/react-native/README.md`.

## Architecture

### Monorepo Layout

```
spec/           ← Single source of truth (never overridden by implementations)
  api/openapi.yaml        ← Full API contract
  db/schema.sql           ← PostgreSQL reference schema
  styles/tokens.css|json  ← Design tokens (semantic colors, spacing, typography)
backends/       ← 10 independent backend implementations (ports :29000–:29090)
frontends/      ← 5 SPA implementations (ports :7173–:7180)
fullstacks/     ← 5 self-contained apps (ports :7177–:7182)
verification/   ← Black-box contract + UI smoke tests
scripts/        ← hello CLI (dev-manager v2)
docs/           ← Requirements (01), Design (02), Roadmap (03)
ui-prototype/   ← Static HTML design reference
```

### Execution Model

- **Backends** each expose `/api/v1/*` on their own port.
- **Frontends** are SPAs that proxy API calls to `:9080`.
- **Reverse proxy** (`:9080`): `hello switch <backend>` points it at any backend, so the frontend doesn't need a restart.
- **Full-stacks** are self-contained (no proxy needed).
- **Dev UI** (`:9090`): web interface for managing all services.

### Spec-Driven Contract

`spec/` is authoritative. Implementations must conform to it — no freelancing. Verification scripts validate from outside (black-box) so internal implementation details don't matter as long as the contract is satisfied.

### Database Strategy

Every backend and full-stack must support both PostgreSQL and SQLite. Switching is done via environment variables:

```bash
DB_DRIVER=postgres   # default
DB_DRIVER=sqlite
DB_URL=<connection string>
```

Database schema/data lifecycle is handled outside backend implementations:

- `./scripts/db init` creates schema from `spec/db`.
- `./scripts/db reset --seed` rebuilds schema and imports demo data.
- `./scripts/db seed` imports demo data idempotently.
- Backend `run` scripts must not create/reset schema, run migrations, seed data, or call repo-level maintenance scripts.
- PostgreSQL connection details come from Web UI / `data/.hello-state.json`; do not attempt Docker startup/probing by default.

### Authentication

JWT (HS256) with refresh token rotation and family tracking. The `refresh_tokens` table tracks `family_id` and `revoked` status for compromise detection.

### Data Model

```
users → capsules → favorites (with favorite_count denormalized on capsules)
users → refresh_tokens
```

`favorite_count` is denormalized to avoid JOINs on plaza sorts; maintain it in a transaction or trigger per-stack idiom.

### Styling

Tailwind CSS v4 + semantic design tokens. All color/spacing references must use token names from `spec/styles/tokens.css` — hardcoded values are prohibited. `tokens.css` is the source; `tokens.json` is derived.

## Per-Stack Notes

- **Reference stack**: FastAPI (backend) + React (frontend) — implement these first (M1); all others follow their patterns.
- Each implementation uses **stack-idiomatic** patterns: Vue Composition API, React Hooks, Angular Signals, Svelte Runes, SolidJS Signals, etc.
- Layering for backends: presentation → application → domain → infrastructure.
- Full-stacks may be server-rendered or API-based, per framework idiom.

### LLM 调用日志规范

每个后端的 LLM 客户端模块必须在以下三个时机写结构化日志（INFO/WARNING 级别）：

| 时机 | 级别 | 必含字段 |
|---|---|---|
| 请求发出前 | INFO | `model=`, `url=` |
| 响应成功 | INFO | `model=`, `elapsed_ms=`, `tokens=`（不可用写 n/a） |
| 请求失败 | WARNING | `model=`, `elapsed_ms=`, `status=`（HTTP 错误）或 `error=`（网络/超时） |

前缀统一用 `LLM request` / `LLM response` / `LLM error`，方便 `grep "^.*LLM "` 过滤。

参考实现：`backends/fastapi/app/services/llm_client.py` 的 `_post_json()`。

## Port Allocation

| Range | Purpose |
|---|---|
| :29000–:29090 | Backends (10 implementations) |
| :7173–:7180 | Frontends (5 implementations) |
| :7177–:7182 | Full-stacks (5 implementations) |
| :9080 | Reverse proxy (backend switcher) |
| :9090 | Dev manager UI |
| :55432 | PostgreSQL |

## Key Design Decisions (from `docs/02-design.md`)

- **Deletion**: Users can delete their own capsules at any time; capsule content and unlock date are immutable after creation.
- **Out of scope**: password reset, OAuth, file uploads, comments, email notifications.
- **Verification**: External black-box scripts only — don't add implementation-aware shortcuts.
- **Ports**: Chosen to avoid conflicts with the older `HelloTimeByClaude` project.

## Cross-Stack Dev Notes

Accumulated pitfalls and solutions across all stacks (LLM integration, Svelte quirks, Spring cross-DB mapping, local Postgres setup, quality policy): **`docs/dev-notes.md`**
