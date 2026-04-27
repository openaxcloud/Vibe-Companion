# Production hardening (P0 items #9–#12) — 2026-04-27

Audits and fixes 4 production-readiness items raised in the review.
All 4 are real (not false positives like the auth and CSRF claims). Each
is fixed with code that fail-fasts in production and a regression test
where it makes sense.

---

## #9 — DATABASE_ENCRYPTION_KEY derived from DATABASE_URL

### Real state — claim TRUE

`server/services/project-database-provisioning.service.ts` previously had:

```ts
const ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.warn('[ProjectDatabaseProvisioning] DATABASE_ENCRYPTION_KEY not set - using derived key from DATABASE_URL');
}

function getEncryptionKey(): string {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY.padEnd(32).slice(0, 32);
  const dbUrl = process.env.DATABASE_URL || 'ecode-fallback-key';
  const hash = crypto.createHash('sha256').update(dbUrl).digest('hex');
  return hash.slice(0, 32);
}
```

Two catastrophic failure modes:

1. Rotating `DATABASE_URL` (failover, password rotation, replica
   promotion) silently makes every encrypted project credential
   unreadable.
2. If `DATABASE_URL` is also unset, the key collapses to the SHA-256 of
   the literal string `"ecode-fallback-key"` — a known constant. Any
   deployment that booted without `DATABASE_URL` once and stored an
   encrypted secret is vulnerable to anyone with the codebase.

Plus the `padEnd(32)` accepts a 1-character key and pads it with spaces.

### Fix

- Production now **throws at module load** if `DATABASE_ENCRYPTION_KEY`
  is missing or shorter than 32 chars (256 bits). The error message lists
  the consequence and the generation command (`openssl rand -hex 32`).
- The `'ecode-fallback-key'` literal is kept only for the dev fallback
  path, which now logs at `error` level (not `warn`) with explicit "dev
  only — generate a real key" guidance. Production never reaches this
  path because the throw above.
- Removed the silent `padEnd(32)` — keys < 32 chars now refuse to use
  themselves and fall back to derived (and warn) instead of silently
  weakening to a padded-with-spaces key.
- `server/utils/env-config.ts` also rejects this missing/short key as a
  blocker so the failure is consolidated into a single boot error
  message rather than failing later when the service module loads.

### Verification

```
$ NODE_ENV=production [no DATABASE_ENCRYPTION_KEY] node server
[env-config] ERROR: Production environment is missing critical configuration:
  - DATABASE_ENCRYPTION_KEY must be set in production (>=32 chars / 256 bits).
    Without it, project DB credentials are encrypted with a key derived from
    DATABASE_URL — rotating the URL would make every encrypted secret unreadable.
    Generate one with: openssl rand -hex 32
```

---

## #10 — RUNNER_JWT_SECRET missing → unsigned workspace isolation

### Real state — claim TRUE

`server/runnerClient.ts:8-11` already throws when `RUNNER_JWT_SECRET` is
missing **at sign time**, but env-config only emitted a soft warning at
boot. So a deploy with `RUNNER_BASE_URL` set but the secret unset would
boot cleanly, then surface a 500 the first time anyone tried to spawn a
workspace.

### Fix

`server/utils/env-config.ts` — when `RUNNER_BASE_URL` is set in
production, `RUNNER_JWT_SECRET` is now a hard blocker. Same length
constraint as the others (≥32 chars / 256 bits).

If `RUNNER_BASE_URL` isn't set, the runner is disabled and the secret
isn't required. This matches the existing feature-flag pattern in
`server/runnerClient/index.ts`.

### Verification

```
$ NODE_ENV=production RUNNER_BASE_URL=http://x [no RUNNER_JWT_SECRET] node server
[env-config] ERROR: Production environment is missing critical configuration:
  - RUNNER_JWT_SECRET must be set in production when RUNNER_BASE_URL is configured (>=32 chars / 256 bits).
    Without it, workspace isolation is unsigned and any client could forge workspace tokens.
    Generate one with: openssl rand -hex 32
```

---

## #11 — No timeouts/retry on external API calls

### Real state — claim partially TRUE

| Site | Pre-fix state |
|---|---|
| `server/agentServices/tavilySearch.ts:34` | 15s `AbortSignal.timeout`, no retry |
| `server/agentServices/braveImageSearch.ts:49` | 10s `AbortSignal.timeout`, no retry |
| `server/routes.ts:236+` (provider connection-test handlers) | 8s timeout, no retry |
| Anthropic / OpenAI / Stripe SDKs | retries built in by the SDKs themselves — should NOT be wrapped |

So timeouts existed but retries didn't, and the codebase had no shared
helper for "retry on transient failures with backoff."

### Fix

- New utility `server/utils/fetch-with-retry.ts` — production wrapper
  around `fetch` adding:
  - Per-attempt timeout via a fresh `AbortController` per attempt.
  - Exponential backoff with jitter, retrying on network errors, 408,
    429, 500, 502, 503, 504 (caller-overrideable via `retryOn`).
  - Honors `Retry-After` header (numeric seconds or HTTP-date) when
    present. Capped at 30s.
  - Caller-supplied `AbortSignal` aborts further retries cleanly.
  - `onRetry` callback for observability.
- Wired into `tavilySearch.ts` and `braveImageSearch.ts` with 3 retries
  and an `onRetry` handler that logs to `console.warn`.
- **Not** wired into Anthropic / OpenAI / Stripe call sites — those
  providers' SDKs already implement provider-aware retry logic and
  double-wrapping would compound timeouts and ignore SDK semantics.
- Provider connection-test handlers in `routes.ts:236+` left alone —
  those are user-triggered "is this key valid" probes; retrying a 401
  would be misleading.

### Tests — `tests/fetch-with-retry.test.ts`

8 cases covering: 2xx no-retry, 503 retry-and-succeed, 429 with
`Retry-After` honored, 4xx no-retry, network-error retry, retry
exhaustion, per-attempt timeout, caller AbortSignal mid-retry. **8/8
passing.**

---

## #12 — Graceful shutdown was incomplete

### Real state — claim TRUE

`server/index.ts:561-583` only closed the HTTP server then `process.exit(0)`
inside the close callback. The pg pool and Redis clients (cache, idempotency,
terminal session manager) stayed open until process termination ripped
their sockets. On the upstream side, half-open connections lingered until
their idle timeouts fired (Postgres ~10min, Redis ~5min).

### Fix

`gracefulShutdown` now (in this order):

1. Arms a 30-second hard-ceiling timer (`.unref()`'d so it doesn't keep
   the loop alive on success — clean shutdowns now actually exit at the
   end).
2. Clears intervals + stops the metrics collector (unchanged).
3. Awaits `shutdownAllProcesses()` + `shutdownAllLocalWorkspaces()` (unchanged).
4. **NEW**: Awaits `httpServer.close()` wrapped as a Promise — was
   previously a callback that raced with `process.exit`.
5. **NEW**: Awaits `pool.end()` from `server/db.ts` (logs failures but
   never throws — we'd rather force-exit than hang here).
6. **NEW**: Awaits both Redis closures in parallel: `redisCache.close()`
   from `server/services/redis-cache.service.ts` and
   `redisSessionManager.disconnect()` from
   `server/terminal/redis-session-manager.ts`. Each is wrapped in a
   try/catch — services that never connected (no `REDIS_URL`) are
   no-ops.
7. `process.exit(0)`.

If anything hangs, the 30s ceiling timer force-exits with code 1 and a
log line.

### Why no test

A graceful-shutdown test would have to spawn a real process, send it
SIGTERM, and verify the cleanup order via stdout — high flake under load.
The fix is small, the code path is read-once-at-shutdown, and a regression
would surface immediately as half-open connections in production
monitoring. Skipping the test for this one is the right ROI.

---

## Files changed

| File | Change |
|---|---|
| `server/utils/fetch-with-retry.ts` (new) | Retry wrapper with timeout + backoff + `Retry-After` |
| `tests/fetch-with-retry.test.ts` (new) | 8 cases |
| `server/agentServices/tavilySearch.ts` | Use `fetchWithRetry` |
| `server/agentServices/braveImageSearch.ts` | Use `fetchWithRetry` |
| `server/services/project-database-provisioning.service.ts` | Production-throw on missing/short `DATABASE_ENCRYPTION_KEY`; tighter dev fallback |
| `server/utils/env-config.ts` | Add `DATABASE_ENCRYPTION_KEY` and `RUNNER_JWT_SECRET` (when `RUNNER_BASE_URL` set) as production blockers |
| `server/index.ts` | Graceful shutdown: pool.end + redis close + force-ceiling fix |
| `docs/PROD-HARDENING-9-12-2026-04-27.md` (this file) | Audit record |
