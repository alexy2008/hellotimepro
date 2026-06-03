# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HelloTime Pro** is a multi-stack teaching project: the same time-capsule web app implemented across 10 backends, 5 frontends, and 5 full-stacks. All implementations share a single API contract and design system defined in `spec/`. **M0 and M1 are complete**: the reference FastAPI + React implementation is built and verified. Current work is M2 expansion.

## Commands

Each implementation has its own `./run`, `./build`, and `./test` scripts. Use the top-level dev manager for orchestration:

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
- `./verification/scripts/verify-ui-smoke.sh <react|vue|angular|svelte|next|nuxt>` explicitly runs `./scripts/db init` before starting the target; it does not reset or seed data.
- Latest full-stack contract run on 2026-06-02 passed: next PostgreSQL 104/104, next SQLite 104/104, nuxt PostgreSQL 104/104, nuxt SQLite 104/104.
- Latest UI smoke run on 2026-06-03 passed: react-ts 25/25, vue3-ts 25/25, svelte 25/25, angular 25/25, next 25/25, nuxt 25/25.

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
