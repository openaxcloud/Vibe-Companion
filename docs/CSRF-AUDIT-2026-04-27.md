# CSRF coverage audit — 2026-04-27

## Claim from the production review

> "CSRF non appliqué globalement — uniquement sur quelques routers (files,
> projects, auth). Manquant sur agent.router.ts, ai.router.ts, payments.router.ts.
> Source : code review subagent."

## Empirical verdict — claim is FALSE

CSRF **is** applied to `/api/agent/*`, `/api/ai/*`, and `/api/payments/*`.
The wiring sits at `server/routes.ts:1341`:

```ts
app.use("/api", csrfProtection);
```

Because Express middleware runs in registration order, and this `app.use`
is registered **before** `mainRouter.registerRoutes(app)` at line 2356
(which mounts agent / ai / payments / etc.), CSRF protects all of them.

### Proof — runtime test against PORT=5101

| Endpoint | POST without `x-csrf-token` | Result |
|---|---|---|
| `/api/agent/start` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/agent/plan` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/agent/build` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/ai/agent` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/ai/generate` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/payments/create-intent` | header missing | **HTTP 403** `Invalid CSRF token` |
| `/api/payments/checkout` | header missing | **HTTP 403** `Invalid CSRF token` |

The "code review subagent" likely missed the global registration because
it sits in the middle of a 21k-line `server/routes.ts`. Reasonable
mistake, but the claim was wrong.

## What was changed in this session

### 1. Regression test (`tests/csrf-coverage.test.ts`)

Hits a real running dev server (no in-process Express stub — those
inevitably miss the actual middleware order from the real routes.ts and
give false confidence). Asserts:

- 9 mutating endpoints across agent / ai / payments / projects / files
  all return **403** without a CSRF token.
- 3 known-exempt endpoints (auth login, csrf-token, stripe webhook) do
  **not** return 403.

Run it with:

```bash
PORT=5101 npm run dev &
until curl -sf http://localhost:5101/api/health >/dev/null; do sleep 2; done
CSRF_TEST_BASE_URL=http://localhost:5101 npx vitest run tests/csrf-coverage.test.ts
```

Result on this branch: **12/12 passing**. Any future refactor that
silently breaks CSRF wiring will fail this test on the next CI run.

### 2. Visibility comment at the wiring site (`server/routes.ts:1341`)

The 21k-line file is the actual source of the false-positive claim. Added
a 6-line comment block above `app.use("/api", csrfProtection)` that:

- Calls out the global guarantee.
- Names the load-bearing line below it (`mainRouter.registerRoutes` at ≈2356).
- Points at the regression test.

So the next reviewer (human or AI) won't have to spelunk to learn this.

## Residual Fortune-500 concerns (not silently fixed — listed for triage)

### A. Two CSRF implementations coexist

| File | Validation strategy | Used by |
|---|---|---|
| `server/routes.ts:csrfProtection` (line 981) | Header+cookie double-submit OR header+session OR header+trusted-origin | Global `app.use("/api", …)` and ~100 inline route registrations |
| `server/middleware/csrf.ts:csrfProtection` (line 126) | Header+session only (stricter) | Per-route in 9 routers: extensions, settings, env-vars, admin, templates, users, secrets, storage, unified-checkpoints |

Both validate against the same `req.session.csrfToken`, but `routes.ts`
also accepts cookie-double-submit and trusted-origin fallbacks that
`middleware/csrf.ts` rejects. A request that authenticates against the
global guard via cookie-double-submit could still fail at the per-route
guard on those 9 routers. This dual implementation is fragile and
should be consolidated to one. Estimated effort: 0.5 day to pick the
strict version, audit clients, drop the fallbacks.

### B. ~100 redundant per-route `csrfProtection` arguments in `routes.ts`

Inline routes from line 1373 onwards re-add `csrfProtection` to each
route definition even though the global `app.use("/api", csrfProtection)`
already covers them. Express runs the middleware twice on these routes —
correct but wasteful. Estimated effort: 0.5 day mechanical grep+remove.

### C. The exempt list is duplicated

`server/routes.ts:CSRF_EXEMPT_PATHS` (line 945) and
`server/middleware/csrf.ts:EXCLUDED_PATHS` (line 18) overlap but don't
match exactly — `routes.ts` exempts `/api/csrf-token`, `/api/stripe/webhook`,
`/api/billing/webhook`, `/api/feedback`, `/api/analytics/track`,
`/api/webhooks/automation`, `/api/slack/events`, while `middleware/csrf.ts`
only exempts `/api/webhooks/stripe`, `/api/webhooks/github`,
`/api/logs/ingest`, plus the auth endpoints. They will drift; merge into
a single source of truth as part of (A).

### D. No test catches the consolidation work

Once (A)/(B)/(C) are addressed, the regression test in this session
covers the *outcome* (403 on protected, non-403 on exempt), but the
test doesn't yet verify the *exempt list completeness*. If a new exempt
path is added without updating the test, drift could go unnoticed. Low
priority — extend `EXEMPT_ROUTES` in the test as new exemptions land.

## Summary of files changed

| File | Change |
|---|---|
| `tests/csrf-coverage.test.ts` (new) | 12-case regression test against live dev server |
| `server/routes.ts` | 6-line comment block above the global `app.use("/api", csrfProtection)` |
| `docs/CSRF-AUDIT-2026-04-27.md` (this file) | Audit record + proof + residual debt |

## Verdict

| Item | Status |
|---|---|
| CSRF on agent/ai/payments routers | ✅ already covered (claim was false); now locked in by test |
| Wiring visibility for future reviewers | ✅ inline comment + audit doc |
| Dual CSRF implementations | ⚠️ residual debt — 0.5 day to consolidate |
| Redundant per-route `csrfProtection` | ⚠️ residual debt — 0.5 day mechanical cleanup |
| Exempt-list drift between the two impls | ⚠️ residual debt — fix as part of consolidation |
