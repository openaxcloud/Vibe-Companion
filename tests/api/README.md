# API Critical-Path Tests

Supertest specs covering 5 critical API paths.  
All tests run in-process (no child-process spawn) against a live Postgres DB.

## Prerequisites

- `DATABASE_URL` pointing to a Postgres instance with the full schema applied.
- `ENCRYPTION_KEY` + `SESSION_SECRET` set (auto-generated in non-prod if unset).
- `supertest` installed (`npm install --save-dev supertest @types/supertest`).

## Run locally

```bash
# All 5 specs
npx vitest run tests/api

# Single spec with verbose output
npx vitest run tests/api/01-workspace-bootstrap.test.ts --reporter=verbose
```

## Run in CI

The GitHub Actions workflow already includes `tests/api/**/*.test.ts` via the
`tests/**/*.test.ts` glob in `vitest.config.ts`.

## Test map

| File | Route(s) | Cases |
|---|---|---|
| `01-workspace-bootstrap.test.ts` | `POST /api/workspace/bootstrap` | happy-path, 400 missing prompt, 401 unauth, 429 rate-limit |
| `02-ai-agent.test.ts` | `POST /api/ai/agent` | SSE event sequence, userId coercion (b145330d fix) |
| `03-file-crud.test.ts` | `POST/GET/PATCH/DELETE /api/projects/:id/files` | full CRUD, 403 cross-user |
| `04-ws-terminal.test.ts` | `WS /ws/terminal` | 401 no session, 403 wrong project, coercion assertion |
| `05-preview.test.ts` | `GET /api/preview/projects/:id/preview/` | 200 text/html, 401 unauth, 404 missing project |

## Architecture notes

- Each test file builds its own minimal Express app with an **in-memory session store**
  (`express-session` MemoryStore) — no Postgres session table dependency.
- Auth is injected by a middleware that sets `(req.session as any).userId = userId`
  before the routes under test.
- CSRF protection is bypassed for tests 01 by setting `NODE_ENV=development` +
  `DISABLE_CSRF=true` in `beforeAll` (reverted in `afterAll`).
- `@anthropic-ai/sdk` is mocked via `vi.mock()` in test 02 so no real API calls are made.
- Tests 03-05 use real DB operations and clean up after themselves via `deleteTestUser` /
  `deleteTestProject` in `afterAll`.
