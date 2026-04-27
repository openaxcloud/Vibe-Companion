# Deployment guide — production rollout

This document is the operator playbook for taking Vibe-Companion / E-code from
a fresh hosting environment to a fully-running, production-grade deployment.

It is the operational counterpart of [`HANDOFF.md`](HANDOFF.md) — `HANDOFF.md`
covers the one-time checklist after Phase 1-4 modernization landed; this file
covers how to deploy the platform to *any* environment, day-to-day operations,
rollback, and monitoring.

> **Status (2026-04-27):** the application code is production-ready
> ([`SMOKETEST-2026-04-26.md`](SMOKETEST-2026-04-26.md), 13/13 quality criteria
> on Opus 4.7 / Sonnet 4.6 / GPT-4.1; critical-path validation complete,
> [`AUDIT-CRITICAL-PATH-2026-04-27.md`](AUDIT-CRITICAL-PATH-2026-04-27.md)).
> What follows is the infrastructure side.

---

## 1. Prerequisites

| Requirement | Why | Notes |
|---|---|---|
| **Node.js 20 LTS** | runtime | `.replit` pins `nodejs-20` |
| **PostgreSQL 16** | persistent store (sessions, projects, files, AI usage, …) | Neon / Supabase / managed Replit Postgres / self-hosted all OK |
| **Redis 7** *(recommended)* | rate limiting, prompt cache, session affinity in multi-replica | falls back to in-memory if `REDIS_ENABLED=false` (single-replica only) |
| **S3-compatible object storage** *(recommended)* | uploaded assets, user attachments, generated images | Cloudflare R2 / AWS S3 / MinIO |
| **A reachable public domain + TLS cert** | OAuth callbacks, share links, email links | Replit Deployments auto-issues; otherwise Caddy / nginx + Let's Encrypt |
| **An Anthropic API key** at minimum | primary AI provider | OpenAI / Gemini optional fallback |

The platform **will refuse to boot** without `DATABASE_URL`, `SESSION_SECRET`,
`ENCRYPTION_KEY`, and at least one AI provider key.

---

## 2. Environment variables

The exhaustive template is at [`.env.production.example`](../.env.production.example)
(~70 curated variables out of 341 referenced in the codebase).

The minimum to boot:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/ecode
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
APP_URL=https://your-domain.com
APP_DOMAIN=your-domain.com
BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
ANTHROPIC_API_KEY=sk-ant-...
```

Strongly recommended for a real customer-facing deployment:

```bash
# Sessions persist across replicas
REDIS_URL=redis://default:pass@host:6379

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Verification + password-reset emails
SENDGRID_API_KEY=SG....    # or SMTP_HOST/USER/PASS

# Asset uploads
S3_BUCKET=ecode-prod-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# OAuth providers
GITHUB_CLIENT_ID=Iv1...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Admin
ADMIN_API_KEY=$(openssl rand -hex 32)
ADMIN_IP_WHITELIST=1.2.3.4,10.0.0.0/8
```

### Secrets management

- **Replit Deployments:** use the *Secrets* panel (encrypted at rest, never
  exposed in logs). The deploy auto-restarts on secret change.
- **Self-hosted:** prefer Doppler / 1Password CLI / SOPS / `systemd-creds` over
  a plain `.env` on disk.
- **CI:** GitHub Actions secrets (Settings → Secrets and variables → Actions),
  scoped to the deploy job only.

Never commit `.env` or `.env.production`. The repo's `.gitignore` covers them
but double-check before pushing a new branch.

---

## 3. Database

### Initial provisioning

```bash
# 1. Apply Drizzle schema
npm run db:push

# 2. Apply the audit migrations in order (already in repo)
psql "$DATABASE_URL" -f migrations/0019_workspace_bootstrap_fix.sql
psql "$DATABASE_URL" -f migrations/0020_panel_audit_schema_sync.sql
psql "$DATABASE_URL" -f migrations/0021_create_missing_tables.sql
psql "$DATABASE_URL" -f migrations/0022_ai_plans_and_themes.sql
psql "$DATABASE_URL" -f migrations/0023_terminal_unblock.sql
psql "$DATABASE_URL" -f migrations/0024_tenant_id_backfill.sql

# 3. Seed the initial admin
ADMIN_USER_PASSWORD='use-a-real-password-or-omit-for-random' \
  npx tsx server/db-seed.ts
# The script prints the admin password to stdout EXACTLY ONCE — save it.
```

Migrations 0019 → 0024 are idempotent (`CREATE TABLE IF NOT EXISTS`,
`ALTER TABLE … RENAME` guarded by `information_schema` checks). Re-running
them on a partially-applied DB is safe. They fix every drift identified in
[`AUDIT-CRITICAL-PATH-2026-04-27.md`](AUDIT-CRITICAL-PATH-2026-04-27.md).

### Backups

```bash
# Daily logical backup (cron)
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  > /backups/ecode-$(date +%Y-%m-%d).dump

# Restore
pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" \
  /backups/ecode-2026-04-27.dump
```

If you're on Replit / Neon / Supabase, prefer their managed PITR — much faster
restore (~minutes vs hours) and configurable retention.

**Test the restore quarterly** on a staging DB. Untested backups are not
backups.

### Schema migration policy

- New columns / tables → add a numbered `migrations/0NNN_*.sql` file, idempotent
  (`IF NOT EXISTS`), and update `shared/schema.ts` in the same PR.
- **Never** edit a previously-shipped migration. If you need to revert, ship a
  new migration that undoes it.
- Drizzle `db:push` is for the schema declaration only — do not rely on it to
  sync against the live DB without running the audit migrations first (see the
  drift findings in the audit doc).

---

## 4. Build

```bash
npm ci                 # production install, locked to package-lock.json
npm run build          # tsc --noEmit + tsx script/build.ts → dist/
npm start              # NODE_ENV=production node dist/index.cjs
```

`npm run build` runs:
1. `tsc --noEmit` — typecheck baseline (~3,020 known errors, non-blocking;
   see CLAUDE.md "Dette technique connue").
2. `tsx script/build.ts` — bundles server + client, emits `dist/`.

The build is deterministic given the same `package-lock.json`. If you see
non-deterministic bundle hashes, the lockfile is out of sync.

---

## 5. Deployment targets

### 5a. Replit Deployments *(canonical target)*

The repo is set up for Replit Deployments out of the box.

```text
.replit                  → runtime config (Node 20, Postgres 16, port mapping)
replit.deploy.toml       → deployment-specific config
replit.nix               → Nix env (system deps)
```

Steps:

1. Open https://replit.com/@henri45/E-code
2. Pull from GitHub:
   ```
   git fetch origin
   git checkout main
   git pull
   ```
3. *Secrets* panel → paste every variable from §2.
4. *Deploy* → choose **Reserved VM** (closest to single-VM mode the
   `deploymentEngine.ts` was tested against; **Autoscale** also works but
   adds cold-start latency on terminal/preview WS).
5. After first deploy, run the seed in the Replit shell:
   ```
   npx tsx server/db-seed.ts
   ```
6. Visit `https://<your-deployment>.replit.dev/api/health` — should return
   `{ "status": "healthy", … }`.

### 5b. Self-hosted (Docker / VM)

The repo has no published Dockerfile, but the runtime is a vanilla Node 20
process. A minimal Dockerfile:

```Dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

Behind a reverse proxy:

```nginx
# /etc/nginx/sites-enabled/ecode.conf
upstream ecode { server 127.0.0.1:5000; }

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  client_max_body_size 50m;

  location / {
    proxy_pass http://ecode;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;       # long for AI streaming
    proxy_send_timeout 3600s;
  }
}
```

`X-Forwarded-Proto` is required so Express trusts the proxy and emits secure
cookies (`app.set('trust proxy', 1)` is already set in `server/index.ts:75`).

### 5c. Other platforms

| Platform | Notes |
|---|---|
| **Render / Railway / Fly.io** | Use the `Dockerfile` from §5b, persist volumes for `/app/uploads` and `/app/project-workspaces`. |
| **Kubernetes** | A `legacy-archive/` set of manifests existed but was archived in commit `eefeae43`. Single-VM mode is the supported path. |
| **AWS ECS / Fargate** | Same Dockerfile. Use ALB with sticky sessions if you skip Redis. |

---

## 6. Health checks

| Endpoint | Use case | Returns |
|---|---|---|
| `GET /api/health` | uptime monitor / load balancer | 200 with `{status, uptime, memory, version}` |
| `GET /api/ready` | k8s readiness probe equivalent | 200 only when DB is reachable |

Recommended monitor:

- **Uptime:** ping `/api/health` every 30s; alert if 3 consecutive failures.
- **Latency budget:** `/api/health` < 500ms; `/api/projects/:id` < 1s; AI
  generation streams should emit the first `data:` event < 5s of POST.

---

## 7. CI/CD

`.github/workflows/` already contains:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push, PR | lint + typecheck (non-blocking baseline) + tests + build |
| `ci-cd-production.yml` | tag `v*` | full prod build + deploy hook |
| `deploy-main.yml` | push to `main` | trigger Replit Deployments redeploy |
| `replit-deployment.yml` | manual | sync GitHub → Replit |
| `tenant-isolation-tests.yml` | nightly | row-level security regression checks |
| `verify-codex-prs.yml` | PR labelled `codex` | extra checks for AI-generated PRs |
| `build-desktop.yml`, `build-mobile.yml` | tag, manual | desktop/mobile companion app builds |

To enable: Settings → Actions → *Allow all actions and reusable workflows*.
No tokens required for the default jobs (`ci.yml` runs against the public
checkout). Deploy workflows need `REPLIT_TOKEN` and `REPLIT_DEPLOY_HOOK_URL`
in repo secrets.

### Release process

1. Cut a release branch from `main` (`git checkout -b release/2026-05-01`).
2. Bump `version` in `package.json`.
3. Open a PR → review → merge.
4. Tag: `git tag -a v$(jq -r .version package.json) -m "release"`.
5. Push: `git push origin --tags`.
6. `ci-cd-production.yml` picks up the tag, runs the full build, and the
   deploy hook fires to the Replit Deployments environment.

---

## 8. Monitoring

### Sentry (server + client)

Set `SENTRY_DSN` (server) and `VITE_SENTRY_DSN` (client). Both are *opt-in*
via dynamic import — if the DSN is unset, Sentry never loads, no perf hit.

Recommended Sentry alerts:
- `level:fatal` → Slack `@here`
- New `level:error` issue first-seen → email on-call
- Regression of resolved issue → Slack channel

### Slack alerts

Set `SLACK_WEBHOOK_URL`. The slack-alert service stays disabled until
configured. Alerts include: deploy failures, AI provider circuit-breaker
trips, rate-limit storms, DB pool exhaustion.

### Logs

Logger uses `winston` with daily rotate (`winston-daily-rotate-file`):
- `logs/error-%DATE%.log` (rotated, gzipped after 14 days)
- `logs/combined-%DATE%.log` (rotated, gzipped after 7 days)

Built-in redaction strips: `password`, `token`, `apikey`, `Bearer …`,
`sk-…`, `pk-…`, postgres URLs. Non-bypassable.

### Metrics endpoint

`GET /api/metrics` returns Prometheus-format counters:
- `ecode_requests_total{method, route, status}`
- `ecode_request_duration_seconds_bucket`
- `ecode_ai_provider_calls_total{provider, model, fallback}`
- `ecode_ai_credits_consumed_total{user_tier}`

Scrape every 15s from your Prometheus / Grafana stack.

---

## 9. Security checklist

Already enabled in code (verify at deploy time):

- [x] HTTPS only — `app.set('trust proxy', 1)` honours `X-Forwarded-Proto`.
- [x] Helmet CSP whitelisting AI provider domains.
- [x] HSTS via `helmet({ strictTransportSecurity: { maxAge: 31536000, ... } })`.
- [x] `connect-pg-simple` PostgreSQL session store (no in-memory in prod).
- [x] CSRF protection on state-changing routes (`csrfProtection` middleware).
- [x] Rate limits via `express-rate-limit` + `rate-limiter-flexible`
      (Redis-backed when configured, otherwise in-memory).
- [x] Logger redaction of secrets (server/utils/logger.ts).
- [x] Encrypted-at-rest secrets — `ENCRYPTION_KEY` AES-256-GCM via
      `server/encryption.ts`.

To add at the perimeter:

- [ ] Cloudflare / AWS WAF in front, with bot-protection rules.
- [ ] DDoS protection (Cloudflare, AWS Shield, or platform default).
- [ ] Backups encrypted at rest (S3 SSE-KMS / Postgres pgcrypto).
- [ ] Quarterly secrets rotation: `SESSION_SECRET`, `ENCRYPTION_KEY`,
      `ADMIN_API_KEY`, all OAuth client secrets. Document the rotation
      runbook in your team's wiki.

---

## 10. Common runbooks

### Server won't start

1. `node --version` — must be 20.x.
2. `npm run check` — typecheck. ~3,000 baseline errors are expected; a fresh
   ReferenceError or unresolved import is not.
3. `curl https://your-domain.com/api/health` — if 502, check the process is
   listening; if 500, check the DB connectivity.
4. `psql "$DATABASE_URL" -c '\dt' | head` — verify the migrations are applied.
5. Tail logs: `tail -100f logs/error-$(date +%Y-%m-%d).log`.

### "Loading workspace…" never lifts

Same root cause as the 2026-04-27 audit. Check, in order:

1. `GET /api/projects/:id` returns 200 (not 500/403).
2. Browser DevTools console — look for "Rendered more hooks than during the
   previous render" (would indicate a regression of Bug #1).
3. `GET /api/workspace/bootstrap-prompt/:id` returns valid JSON.
4. Browser network tab — look for failing `/api/themes`, `/api/projects/:id/files`
   (each crash takes the SPA out of the bootstrap loop).

The audit doc has the diagnostic procedure end-to-end.

### AI generation falls back to GPT / Gemini despite Anthropic key

1. Server log: search for `[fallback]` lines — they include the trigger reason.
2. `GET /api/health/providers` — circuit-breaker state per provider.
3. If `anthropic` is in `open` state, the rate of 5xx from `api.anthropic.com`
   exceeded the threshold. Wait 60s for the half-open probe, or restart.
4. Verify `ANTHROPIC_API_KEY` doesn't have stray whitespace (`cat -A .env | grep
   ANTHROPIC` — any `^M$` or trailing `$` after non-`\n` means re-paste).

### Rolling back a bad release

```bash
# Replit
git revert <bad-commit> -m 1   # if it was a merge
git push origin main           # auto-redeploys

# Self-hosted
git checkout <last-good-tag>
npm ci && npm run build
systemctl restart ecode
```

If the bad release ran a destructive migration:

```bash
psql "$DATABASE_URL" -f migrations/<NNN>_revert.sql   # ship one in the same PR
```

`ALTER TABLE … RENAME TO …_legacy_archived` is preferred over `DROP TABLE` for
non-trivial data — see the `themes` and `deployments` patterns in migrations
0022 / 0023.

### Hotfix to production

1. Branch from `main`: `git checkout -b hotfix/<issue>`.
2. Minimal fix + test.
3. PR → merge to `main` → CI runs → `deploy-main.yml` redeploys.
4. Cherry-pick into the latest release branch if you maintain one.
5. Post-mortem in `docs/INCIDENTS/<date>-<issue>.md`.

---

## 11. Scaling & capacity

| Bottleneck | Symptom | Fix |
|---|---|---|
| Single Node process | CPU pegged on AI generation | Run multiple replicas behind LB. Requires Redis-backed sessions. |
| Postgres connections | "too many connections" errors | Connection pooler (PgBouncer / Neon's built-in) + lower per-replica `pg.Pool` max. |
| Redis throughput | rate-limit window misses | Upgrade tier / shard by tenant. |
| Vite dev server *(dev only)* | cold-load 30-40s on first request | Run a build-then-serve in lower envs, not Vite middleware. |
| Anthropic rate limit | fallback to GPT/Gemini under load | Bump tier / add per-user request queueing (built-in via `executionPool`). |
| File storage growing | disk fills | S3 + lifecycle rules; the platform already serves `/uploads/*` from `S3_BUCKET` when configured. |

---

## 12. Manual smoke test (after every deploy)

```bash
DOMAIN=https://your-domain.com

# 1. Health
curl -fsS $DOMAIN/api/health | jq .status            # → "healthy"

# 2. Auth
curl -c /tmp/c -fsS $DOMAIN/api/csrf-token | jq .csrfToken
CSRF=$(curl -s -b /tmp/c $DOMAIN/api/csrf-token | jq -r .csrfToken)
curl -fsS -b /tmp/c -X POST $DOMAIN/api/auth/login \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF" \
  -d '{"email":"admin@your-domain.com","password":"…"}' | jq .id

# 3. Project + AI generation
curl -fsS -b /tmp/c -X POST $DOMAIN/api/workspace/bootstrap \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF" \
  -d '{"prompt":"deploy smoke test - simple counter app"}' | jq .projectId

# 4. CSP header
curl -sI $DOMAIN/api/health | grep -i content-security-policy

# 5. CSP allow-list includes Anthropic
curl -sI $DOMAIN/api/health | grep -o "api\.anthropic\.com"
```

If any of those steps fails, treat it as a P1 — block downstream rollouts and
file an incident.

---

## 13. Support & escalation

- Application errors → Sentry → on-call email.
- Infra (DB, Redis, S3) → managed-provider dashboard.
- Domain / TLS → registrar + Let's Encrypt.
- Replit-specific → https://replit.com/help — has an "Engineer assist"
  channel for paid Deployments tier.

For internal documentation: keep this file under `docs/`, link new runbooks
from §10 as they're written, and review the whole document quarterly.
