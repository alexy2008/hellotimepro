# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**HelloTime Pro** is a multi-stack teaching project: the same time-capsule web app implemented across 10 backends, 5 frontends, and 5 full-stacks. All implementations share a single API contract and design system defined in `spec/`. Currently at **M0 (Design phase)** — the reference FastAPI + React implementation (M1) has not been built yet.

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

docker compose up -d postgres       # Postgres on :55432

# Verification (once implementations exist)
./verification/verify-contract.sh <backend>
./verification/verify-ui-smoke.sh <frontend>
```

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
