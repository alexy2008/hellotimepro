# AGENTS.md
Guidance for OpenCode sessions working in this repository.

## Project State
**M0 and M1 are complete** — The reference FastAPI + React stack is implemented and verified. M2 expansion is now in progress.
`spec/` is the single source of truth; implementations must conform to it exactly.

## Verified Commands
```bash
# Dev manager CLI
./scripts/hello <start|stop|status|switch|doctor|logs|restart-all>

# Database maintenance (explicit; never hidden in backend run scripts)
./scripts/db <status|init|reset|seed>
./scripts/db reset --seed
./scripts/db seed --force

# Postgres
# Use the Web UI / data/.hello-state.json configured local PostgreSQL connection.
# Do not probe or start Docker for PostgreSQL unless the user explicitly asks.

# Reference stack verification
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-ui-smoke.sh react-ts

# Full-stack contract verification
./verification/scripts/verify-contract.sh <next|nuxt>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <next|nuxt>
```

## Verification Notes
- Backend/full-stack contract verification currently covers 104 black-box API cases, including AI capsule suggestion and recommendation endpoints.
- UI smoke verification currently covers 25 Playwright cases across auth, capsule creation/opening, plaza search/favorites, profile, protected routes, public pages, and AI creation helpers.
- `./verification/scripts/verify-contract.sh <target>` applies to backends and full-stacks as long as the target is registered in `hello list` and exposes `/api/v1/*` on its own port.
- `./verification/scripts/verify-ui-smoke.sh <react|vue|angular|svelte|next|nuxt>` explicitly runs `./scripts/db init` before starting the target; it does not reset or seed data.
- Latest full-stack contract run on 2026-06-02 passed: next PostgreSQL 104/104, next SQLite 104/104, nuxt PostgreSQL 104/104, nuxt SQLite 104/104.

## Critical Constraints
- **Spec-driven**: All API, schema, and styling rules live in `spec/`. Never override spec in implementations.
- **Black-box verification only**: No implementation-aware test shortcuts.
- **Styling**: Tailwind CSS v4 + semantic tokens from `spec/styles/tokens.css`. Hardcoded color/spacing values prohibited.
- **Database**: Default Postgres, SQLite via `DB_DRIVER=sqlite` env var. All backends/fullstacks must support both.
- **Local PostgreSQL**: The service is already managed locally and its connection settings are configured through the Web UI / `data/.hello-state.json`; use those settings for Postgres work and do not attempt Docker startup/probing by default.
- **DB lifecycle separation**: Backend `run` scripts only start services. They must not create/reset schema, run migrations, import demo data, or call repo-level maintenance scripts. Use `./scripts/db` for schema init/reset/seed.
- **Denormalization**: `favorite_count` on capsules must be maintained via transactions/triggers per stack idiom.
- **Git commits**: Commit messages must be written in Chinese unless the user explicitly requests otherwise.

## Architecture
- **Monorepo**: `backends/` (10, :29000–:29090), `frontends/` (5 SPA, :7173–:7180), `fullstacks/` (5, :7177–:7182)
- **Proxy**: Frontends point to `:9080` (switched via `hello switch <backend>`). Fullstacks are self-contained.
- **Reference stack**: FastAPI (backend) + React (frontend) — implement first (M1).
- **Backend layering**: presentation → application → domain → infrastructure.

## Port Allocation
| Range | Purpose |
|---|---|
| :29000–:29090 | Backends |
| :7173–:7180 | Frontends |
| :7177–:7182 | Full-stacks |
| :9080 | Reverse proxy |
| :9090 | Dev manager UI |
| :55432 | PostgreSQL |

## Key Design Decisions
- Capsule content/unlock date immutable after creation; users can delete own capsules anytime.
- Out of scope: password reset, OAuth, file uploads, comments, email notifications.
- Ports chosen to avoid conflicts with legacy `HelloTimeByClaude` project.
- Database schema/data maintenance is explicit and implementation-agnostic: `spec/db` is the source, `scripts/db` applies it, and backend implementations consume an already-prepared database.

## LLM 调用日志规范
每个后端的 LLM 客户端模块必须在以下三个时机写结构化日志（INFO/WARNING 级别）：

| 时机 | 级别 | 必含字段 |
|---|---|---|
| 请求发出前 | INFO | `model=`, `url=` |
| 响应成功 | INFO | `model=`, `elapsed_ms=`, `tokens=`（不可用写 n/a） |
| 请求失败 | WARNING | `model=`, `elapsed_ms=`, `status=`（HTTP 错误）或 `error=`（网络/超时） |

前缀统一用 `LLM request` / `LLM response` / `LLM error`，方便 `grep "^.*LLM "` 过滤。
参考实现：`backends/fastapi/app/services/llm_client.py` 的 `_post_json()`。

## Reference Docs
Full details: `docs/01-requirements.md`, `docs/02-design.md`, `docs/03-roadmap.md`
