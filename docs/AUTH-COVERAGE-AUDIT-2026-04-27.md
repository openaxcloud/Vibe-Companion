# Auth coverage audit — 2026-04-27

## Claim from the production review

> "19 routes mutantes sans `requireAuth`. legacy-workspace-runner (24),
> legacy-workflows (18), legacy-task-system (15), legacy-mcp-servers (15),
> legacy-package-management (12)…
> Source : code review subagent. Action : audit ligne par ligne et ajouter
> requireAuth (ou justifier publiquement)."

## Empirical verdict — claim is FALSE

A line-by-line audit of the 5 accused files found **0 mutating routes
without `requireAuth`**. All 57 mutating routes (POST/PUT/PATCH/DELETE)
across those files have `requireAuth` on the same declaration line.

### Where the false positive came from

The numbers in the claim (24, 18, 15, 15, 12) are **near-matches to the
count of `requireAuth` STRING OCCURRENCES** in each file:

| File | Mutating routes | All have `requireAuth`? | `requireAuth` string occurrences | Claim |
|---|---:|---|---:|---:|
| legacy-workspace-runner | 13 | ✅ all 13 | 24 | 24 |
| legacy-workflows | 13 | ✅ all 13 | 19 | 18 |
| legacy-task-system | 12 | ✅ all 12 | 16 | 15 |
| legacy-mcp-servers | 11 | ✅ all 11 | 16 | 15 |
| legacy-package-management | 8 | ✅ all 8 | 13 | 12 |

The "code review subagent" almost certainly counted `requireAuth`
occurrences and mislabeled them as "routes WITHOUT requireAuth" — the
opposite of what the grep output meant. The discrepancy between
"occurrences" and "claim" of 1-2 per file matches the file's 1-2
import lines / type signatures that mention `requireAuth` without being
a route.

### Wider sweep — only 1 truly public mutating legacy route

Across all `server/routes/legacy-*.ts`, only one POST/PUT/PATCH/DELETE
route is genuinely unauthenticated:

| Route | File | Justification |
|---|---|---|
| `POST /api/demo/run` | legacy-demo.ts | Demo code-execution endpoint, intentionally anonymous, IP-rate-limited via `runLimiter` + `checkIpRateLimit` |

All other public-looking mutating routes (login, register, OAuth callbacks,
forgot/reset password, email verification, Stripe webhook, feedback
upload, `/api/desktop/*` analytics, `/api/marketplace/*/track`) are
legitimately public per their function.

### Modular routers (agent / ai / payments / 2fa / etc.)

Spot-checked the routers from the CSRF audit:

| Router | Auth wiring |
|---|---|
| `agent.router.ts` | `router.use(ensureAuthenticated)` (router-level) |
| `ai.router.ts` | `ensureAuthenticated` per-route on every mutating endpoint |
| `payments.router.ts` | `ensureAuthenticated` per-route on every mutating endpoint |
| `2fa.router.ts` | `ensureAuthenticated` per-route except `/challenge/verify` and `/challenge/emergency` (login-flow, challengeId is the credential) |
| `agent-testing.router.ts` | router-level admin-only middleware |
| `agent-autonomous.router.ts` | `router.use(ensureAuthenticated)` (router-level) |
| `agent-step-cache.router.ts` | `router.use(requireAuth)` (router-level) |
| `admin-monitoring.router.ts` | `router.use(ensureAuthenticated)` + `router.use(ensureAdmin)` |

No gaps found.

## What was changed in this session

### `tests/auth-coverage.test.ts` — regression test

Hits the running dev server and asserts:

- 16 mutating routes spanning the 5 accused legacy files plus the
  agent/ai/payments routers all return **401 (auth) or 403 (CSRF — runs
  before auth in the middleware chain)** when called without credentials.
  We never want to see 2xx, 4xx-handler-level (400/404 from inside the
  business logic), or any code that would mean we reached the handler
  past auth.
- 4 intentionally-public routes (`/api/auth/login`, `/api/csrf-token`,
  `/api/stripe/webhook`, `/api/demo/run`) do **not** return 401.

20/20 passing on this branch. Like the CSRF coverage test from earlier
today, this test runs against a real dev server (env `AUTH_TEST_BASE_URL`,
default `http://localhost:5101`) instead of an in-process Express stub,
because the latter cannot reproduce the actual middleware order from the
real `routes.ts` and gives false confidence.

Run it with:

```bash
PORT=5101 npm run dev &
until curl -sf http://localhost:5101/api/health >/dev/null; do sleep 2; done
AUTH_TEST_BASE_URL=http://localhost:5101 npx vitest run tests/auth-coverage.test.ts
```

## Residual debt — none surfaced by this audit

The accused files are clean. The single intentionally-public route
(`/api/demo/run`) is correctly designed and rate-limited.

If a Fortune-500 deeper pass is desired:

- Audit each of the ~30 *non-legacy* modular routers under `server/routes/`
  for a similar guarantee. The 8 sampled here are clean. Estimated effort
  to extend the test to the full modular surface: 0.5 day.
- Add an OWASP-ZAP or Burp-style automated scan in CI that catches
  authentication bypass patterns (e.g. `?bypass=1`, IDOR via path traversal
  on user IDs, etc.). Out of scope here, ~1-2 days.

## Verdict

| Item | Status |
|---|---|
| 5 accused legacy files lack `requireAuth` | ❌ false positive — all 57 mutating routes have it |
| Public mutating routes legitimately unauthenticated | ✅ 1 route (`/api/demo/run`), justified, IP-rate-limited |
| Lockdown via test | ✅ `tests/auth-coverage.test.ts` (20/20 passing) |
| Modular agent/ai/payments routers | ✅ all have `ensureAuthenticated` (router-level or per-route) |
