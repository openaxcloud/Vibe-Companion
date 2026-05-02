# Critical-Path API Tests

Supertest specs for the five highest-risk endpoints identified in the
2026-04-27 audit. These tests catch the class of bugs fixed in commit
b145330d (userId coercion, missing table migrations, WS dispatcher init).

## Specs

| File | Endpoint | Cases |
|------|----------|-------|
| `1-bootstrap.test.ts` | `POST /api/workspace/bootstrap` | happy-path, missing body → 400, unauthenticated → 401, limit reached → 429 |
| `2-agent.test.ts` | `POST /api/projects/:id/agent/message` | SDK mocked at boundary, SSE stream order, 401 without session, userId coercion |
| `3-file-crud.test.ts` | `GET/POST/PUT /api/projects/:id/files` | list, create with tenantId=userId invariant, update by path, access-denied → 403 |
| `4-ws-terminal.test.ts` | `/ws/terminal` handshake | 401 without session, `canAccessProject` coercion (int vs string), valid upgrade |
| `5-preview.test.ts` | `GET /api/preview/projects/:id/preview/` | returns `text/html` 200, 401, no-html → not 500 |

## How to run

### Locally

```bash
# All five specs
npx vitest run tests/api/

# Single spec
npx vitest run tests/api/1-bootstrap.test.ts

# Watch mode while developing
npx vitest tests/api/
```

No real database or external API keys are required. Every external
dependency (PostgreSQL, Anthropic SDK, filesystem syncing) is mocked at
the module boundary inside each test file.

### In CI (GitHub Actions)

The specs run automatically as part of the existing `tests` job in
`.github/workflows/ci.yml`. No additional configuration is needed — the
job already runs `npm test` which invokes `vitest run`.

If you add tests that require a real database, set:

```yaml
env:
  DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
```

and seed with:

```bash
psql $DATABASE_URL < migrations/0019_workspace_bootstrap_fix.sql
# ... through 0024
```

## Architecture

### Mock strategy

Each spec mocks only what would fail without a real environment:

- `server/db.ts` — mocked so `DATABASE_URL` is not required
- `server/storage.ts` — in-memory stub with vitest spies
- `@anthropic-ai/sdk` — mocked constructor + `messages.stream` (test 2)
- `server/services/persistence-engine.ts` — `withScopedTransaction` calls the
  provided callback with a spy-based `TenantScopedQueries` (test 3)
- `server/preview/preview-service.ts` — returns `null` preview so the
  static-file fallback path is exercised (test 5)

Session auth is handled by a `/test/login?userId=X` helper endpoint
injected by `createTestApp()` in `helpers/app.ts`. CSRF is disabled via
`DISABLE_CSRF=true` (supported by the production middleware in dev mode).

### Why these endpoints

The audit identified that all seven blockers traced back to three root
causes affecting these exact code paths:

1. **userId coercion** (`String(userId)`) — affects WS upgrade auth and
   project-scoped DB writes
2. **Missing tenantId** — affects every `withScopedTransaction` call
3. **WS dispatcher not initialised** — affects `/ws/terminal` and
   `/ws/project`

A regression on any of these three causes will now be caught before merge.
