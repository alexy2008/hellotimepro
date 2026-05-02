# AGENTS.md
Guidance for OpenCode sessions working in this repository.

## Project State
**M0 and M1 are complete** — The reference FastAPI + React stack is implemented and verified. M2 expansion is now in progress.
`spec/` is the single source of truth; implementations must conform to it exactly.

## Verified Commands
```bash
# Dev manager CLI
./scripts/hello <start|stop|status|switch|doctor|logs|restart-all>

# Postgres (docker-compose.yml exists)
docker compose up -d postgres  # Runs on :55432

# Reference stack verification
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-ui-smoke.sh react-ts
```

## Critical Constraints
- **Spec-driven**: All API, schema, and styling rules live in `spec/`. Never override spec in implementations.
- **Black-box verification only**: No implementation-aware test shortcuts.
- **Styling**: Tailwind CSS v4 + semantic tokens from `spec/styles/tokens.css`. Hardcoded color/spacing values prohibited.
- **Database**: Default Postgres, SQLite via `DB_DRIVER=sqlite` env var. All backends/fullstacks must support both.
- **Denormalization**: `favorite_count` on capsules must be maintained via transactions/triggers per stack idiom.

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

## Reference Docs
Full details: `docs/01-requirements.md`, `docs/02-design.md`, `docs/03-roadmap.md`
