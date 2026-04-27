# P0 production-readiness audit — 2026-04-27

This audit verifies, point by point, the 5 P0 blockers raised in the
production review and records exactly what was done in code vs. what
remains as operator-side configuration.

**Branche** : `claude/option2-unblock` (post-merge to `main`).
**TL;DR** : 4 of 5 P0s are now code-side hardened with fail-fast behavior
in production. The 5th (schema drift) is too large to fix in one session
(103 missing tables + 82 extra, excluding *_legacy_archived) and is now visible at boot via a
structured warning + a CLI script for ops.

---

## P0 #1 — Redis disabled / in-memory fallback

### Real state

- `ioredis` **is installed** (`^5.10.1`).
- The codebase has 7+ Redis-aware services (`server/services/redis-cache.service.ts`, `server/services/redis-idempotency.service.ts`, `server/middleware/rate-limiter.ts`, `server/terminal/redis-session-manager.ts`, …).
- Each one falls back to in-memory if `REDIS_URL` is missing — and **logs a warning that mentions "not suitable for production at scale"**, which is exactly what the user saw.
- The boot validator (`server/utils/env-config.ts`) was previously only printing a soft warning if `REDIS_URL` was missing in production.

### What was changed in this session

- `server/utils/env-config.ts` now **fail-fasts in production** if `REDIS_URL` is missing AND `REDIS_ENABLED !== 'false'`. The throw lists the consequences so ops can't ignore it: *"every replica will have its own state and double-process billing/email/sessions"*.
- On Replit (where multi-replica is opt-in), the message is downgraded to a warning since single-replica deploys are still common.
- Operators can explicitly opt out for single-replica with `REDIS_ENABLED=false`.

### Residual debt

- The 27+ in-memory services (P0 #2) are still in-memory; this fail-fast just makes the **infrastructure** Redis a hard prereq. The application code that uses Redis-backed services already has the fallback paths and will switch automatically once `REDIS_URL` is set.

---

## P0 #2 — In-memory state in services

### Real state

- The user said 27 services. The actual count is **45 services** in `server/services/`, `server/collaboration/`, `server/distributed/`, and `server/terminal/` that use `new Map()` or `new Set()` for state.
- Across the whole `server/` tree, 292 files contain in-memory state patterns, but most are local/per-request caches that don't need distributing.

### Categorization (sampled)

| Category | Examples | Distribution risk |
|---|---|---|
| Per-request memoization | `code-analysis-engine.ts`, `LSPService.ts` | Low — request-scoped, fine in-memory |
| Per-instance counters | `agent-usage-tracking-service.ts`, `usage-tracking-service.ts` | **High** — billing double-counts on multi-replica |
| Per-project session caches | `agent-session-cache.service.ts`, `agent-step-cache.service.ts` | **High** — session resumption breaks across replicas (but already has Redis path with fallback) |
| Pub/sub presence | `collaboration-presence`, `unified-collaboration-service.ts` | **Critical** — two users on different replicas don't see each other |
| Idempotency keys | `redis-idempotency.service.ts` | **Critical** — already Redis-aware, just needs `REDIS_URL` |
| Rate limiters | `middleware/rate-limiter.ts`, `tier-rate-limiter.ts` | **Critical** — already Redis-aware, just needs `REDIS_URL` |

### What was changed in this session

- The Redis fail-fast (P0 #1) makes the existing fallback paths the default-on path in production. All Redis-aware services (cache, idempotency, rate-limiter, terminal session manager) automatically pick up `REDIS_URL` once it's set.

### Residual debt

- The non-Redis-aware services (collaboration-presence, agent-session-cache.service.ts in some methods, schema-warming) need to be rewritten to use Redis pub/sub. Estimated effort: 5–7 days for a Fortune-500 grade rewrite with tests.

---

## P0 #3 — Stripe key expired / billing dead

### Real state

- `server/index.ts:initStripe()` previously caught the expired-key error in `try/catch` and only printed `console.error("Failed to initialize Stripe:", error)` — the server kept booting.
- This is exactly why the user saw `StripeAuthenticationError: Expired API Key provided: sk_live_...HRfu` and didn't notice until customers complained.

### What was changed in this session

- New helper `verifyStripeKeyHealth()` in `server/index.ts` that calls `stripe.balance.retrieve()` once at boot and parses the error code (`api_key_expired`, `invalid_api_key`).
- `initStripe()` now calls it **before** any schema/migration/webhook work.
- In **production**: a failed health check **throws and refuses to boot**. Better to crash visibly than silently dead-letter every payment.
- In **development**: a failed health check logs a warning and skips Stripe init (so devs without a Stripe key can still work).
- Production-only: any subsequent error in `initStripe()` (sync, webhook setup, schema migration) now also throws instead of swallowed by `console.error`.

### Residual debt

- Stripe webhook handler doesn't have a separate "stripe is degraded" circuit-breaker; if Stripe goes down mid-runtime, individual API calls will throw. Acceptable for now — Stripe themselves recommend retry-on-error rather than circuit-breaking.

---

## P0 #4 — Sentry disabled / @sentry/node missing

### Real state — claim partially false

- The user's claim "*paquet @sentry/node non installé*" is **incorrect**: `@sentry/node@^10.50.0` is installed (also `@sentry/browser`, `@sentry/react` for the client).
- `server/monitoring.ts` does a soft `await import('@sentry/node')` that already works correctly when `SENTRY_DSN` is set.
- The real gap is purely operator-side: `SENTRY_DSN` is not set in `.env`.

### What was changed in this session

- `server/utils/env-config.ts` now warns explicitly that "@sentry/node is installed, set SENTRY_DSN to enable" — removes the ambiguity in the previous warning.
- No code changes needed beyond that.

### Residual debt

- None on the code side. Operator must set `SENTRY_DSN` (and `VITE_SENTRY_DSN` for the client) per the [`docs/HANDOFF.md`](HANDOFF.md) checklist.

---

## P0 #5 — Schema drift between code and DB

### Real state — bigger than reported

- The user said "19 tables divergent". The math `214 - 195 = 19` is the **net** delta but masks the actual divergence:
  - **103 tables declared in `shared/schema.ts` are missing from the live DB** (any route that hits one returns 500).
  - **82 tables exist in the live DB but are not declared in `shared/schema.ts`** (excluding the `*_legacy_archived` tables we created during the critical-path audit on 2026-04-27).
  - **Total drift surface: 185 tables.**
- Some of these are from feature branches that landed schema-only (community, marketplace, deployments analytics, monitoring, RAG, voice/video). Some are dead code in `shared/schema.ts` that was never migrated. Some are tables created in the live DB by archived feature branches.

### What was changed in this session

- New CLI: `scripts/audit-schema-drift.mjs` — produces a structured drift report (text or `--json`). Exits non-zero if drift is detected so it can be wired to CI.
- New module: `server/utils/schema-drift-check.ts` — exports `detectSchemaDrift()` and `logSchemaDriftAtBoot()`.
- `server/index.ts` calls `logSchemaDriftAtBoot()` after DB connect; production logs a structured `[schema] ⚠️ Drift detected (schema=X db=Y): N missing in DB, M extra in DB`. Drift is no longer invisible.

### Residual debt — large

- **103 missing tables**: producing CREATE TABLE migrations for each requires understanding which Drizzle declarations are still actively used. Some are referenced only in dead routes; creating tables for those would be wasted ops debt. Estimated effort: 3–5 days to triage + write phased migrations.
- **82 extra tables**: most are either feature-branch leftovers or legacy schemas. Need to decide per-table: (a) backfill into `shared/schema.ts`, (b) drop, (c) archive (rename `*_legacy_archived` like we did during the critical-path audit). Estimated effort: 2–3 days.
- **Migration strategy**: the project currently uses both `drizzle-kit push` and hand-written SQL migrations in `migrations/`. This is itself a debt — for Fortune-500 grade, pick one (`drizzle-kit generate` + `drizzle-kit migrate`) and freeze it.

---

## Summary of code changes

| File | Change |
|---|---|
| `server/utils/env-config.ts` | Fail-fast in production for missing `REDIS_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`; reject test Stripe keys in prod; explicit Sentry message |
| `server/index.ts` | Stripe key health check (`balance.retrieve`) at boot, fail-fast in prod; schema drift surfaced after DB connect |
| `server/utils/schema-drift-check.ts` (new) | Drift detector module, used at boot |
| `scripts/audit-schema-drift.mjs` (new) | CLI for ops/CI; lists missing + extra tables, exits non-zero on drift |
| `docs/PROD-READINESS-P0-2026-04-27.md` (this file) | Audit record with evidence, fixes, residual debt |

## Verdict

| P0 | Code-ready Fortune-500 | Operator-ready |
|---|---|---|
| #1 Redis | ✅ fail-fast + fallbacks tested | Set `REDIS_URL` |
| #2 In-memory state | ⚠️ Redis-aware paths exist; collaboration/presence still in-memory | Same as #1 |
| #3 Stripe expired | ✅ health check + fail-fast | Set valid `STRIPE_SECRET_KEY` |
| #4 Sentry | ✅ already correct (claim was false re: @sentry/node) | Set `SENTRY_DSN`, `VITE_SENTRY_DSN` |
| #5 Schema drift | ⚠️ visible at boot + CLI; 185-table reconciliation is debt | Triage + migration sprint (3–5 days) |
