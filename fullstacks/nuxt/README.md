# HelloTime Pro · Nuxt Fullstack

Nuxt 3 + Nitro + TypeScript fullstack implementation. UI routes live in `pages/`; REST API routes live in `server/api/v1/`; domain behavior is implemented in `server/services/` and backed by Drizzle ORM. The `run` script builds and serves the Nitro node-server so API and UI are verified through the same production runtime.

## Run

```bash
./scripts/db init                # 初始化数据库（本机 PG，首次需要）
./scripts/hello start nuxt
```

Open <http://127.0.0.1:7178>.

SQLite mode:

```bash
DB_DRIVER=sqlite ./scripts/hello start nuxt
```

## Verify

```bash
./verification/scripts/verify-contract.sh nuxt
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nuxt
```

## Structure

- `pages/`, `layouts/`, `components/`, `stores/`: Nuxt UI implementation, ported from the Vue reference frontend.
- `server/api/v1/`: Nitro REST endpoints matching `spec/api/openapi.yaml`.
- `server/services/`: framework-independent domain/application services.
- `server/db/`: PostgreSQL/SQLite Drizzle schemas and runtime driver switch.
- `drizzle/`: idempotent SQL migrations for both drivers.

## Design Notes

- Auth storage follows the teaching-friendly header token path: access token stays in Pinia memory, while refresh token and user are persisted in `localStorage`. This keeps the Nuxt implementation aligned with the SPA clients and avoids cookie CSRF handling, at the cost of accepting the XSS exposure called out in `docs/02-design.md §7.2`.
