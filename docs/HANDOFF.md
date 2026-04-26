# Handoff — Production launch checklist

State on **2026-04-26**: code-side modernization is complete (phases 1
through 4). What follows is the operator-side checklist Henri needs to
run before the platform can be considered fully live.

## 1. Set production secrets

Use [`.env.production.example`](../.env.production.example) as the
source of truth. The minimum set the server will refuse to boot
without:

- [ ] `DATABASE_URL` — managed Postgres (Replit Postgres / Neon / Supabase)
- [ ] `SESSION_SECRET` — `openssl rand -hex 32`
- [ ] `ENCRYPTION_KEY` — `openssl rand -hex 32`
- [ ] At least one AI key (`ANTHROPIC_API_KEY` is the default primary)
- [ ] `APP_URL` / `APP_DOMAIN` / `BASE_URL` — your real public URL

Strongly recommended for parity with the `.env.production.example` file:

- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (billing)
- [ ] `SMTP_*` or `SENDGRID_API_KEY` (verification + password reset)
- [ ] `S3_*` or `AWS_*` (asset uploads)
- [ ] `REDIS_URL` (rate-limit + cache)
- [ ] `ADMIN_API_KEY` + `ADMIN_IP_WHITELIST`

## 2. Third-party accounts to create

| Service | Why | Where to set |
|---|---|---|
| **Anthropic** | Primary AI provider (Claude 4.7 / 4.6 / 4.5) | `ANTHROPIC_API_KEY` |
| **OpenAI** | Fallback AI provider | `OPENAI_API_KEY` |
| **Google AI Studio** | Gemini 2.5 fallback (optional) | `GEMINI_API_KEY` |
| **Stripe** | Billing | `STRIPE_*` |
| **SendGrid / SMTP** | Transactional email | `SENDGRID_API_KEY` or `SMTP_*` |
| **AWS / Cloudflare R2** | Object storage | `S3_*` / `AWS_*` |
| **Sentry** | Error tracking (server + client) | `SENTRY_DSN`, `VITE_SENTRY_DSN` |
| **GitHub OAuth app** | Sign-in with GitHub | `GITHUB_CLIENT_ID`/`_SECRET` |
| **Google OAuth client** | Sign-in with Google | `GOOGLE_CLIENT_ID`/`_SECRET` |
| **Slack workspace** | Incident alerts | `SLACK_WEBHOOK_URL` |

## 3. Optional packages to install (soft deps)

These deps are referenced by code but not declared in `package.json`
on purpose, so the install stays lean. Install them only when you
plan to use the corresponding feature:

```bash
# Sentry (recommended for production)
npm install @sentry/node @sentry/react @sentry/browser

# E2E browser testing (the background-testing service expects these)
npm install playwright
npx playwright install chromium
```

## 4. Database migrations

```bash
npm run db:push                    # apply Drizzle schemas
npx tsx server/db-seed.ts          # seed admin@test.com (password printed once to stdout — save it!)
```

For production, set `ADMIN_USER_PASSWORD` before seeding so you choose
the password rather than leaving it to the random generator.

## 5. Smoke test the generation pipeline

Once the server is up, exercise the path Henri specifically called out:

1. Sign in with the seeded admin account.
2. Click *New Project* → pick *React + Vite + TypeScript*.
3. Open the AI panel and prompt:
   > Build a modern todo app with dark mode, drag-and-drop, and a
   > sleek glassmorphism design. Use shadcn/ui components and Framer
   > Motion for transitions.
4. Verify the generated code:
   - imports `@/components/ui/...` (shadcn/ui)
   - imports `framer-motion`
   - has a working `dark`-mode toggle
   - renders without build errors in the live preview
5. Save a screenshot of the running preview as
   `docs/demo-screenshot.png` so it's part of the handoff.

If the generation falls back to an older provider (you'll see a
`[fallback]` log line on the server), check that `ANTHROPIC_API_KEY`
is set and the circuit breaker isn't open
(`GET /api/health/providers`).

## 6. CI / GitHub Actions

`.github/workflows/ci.yml` already runs lint + typecheck + tests +
build on every push and PR to `main`. To enable the workflow, just
ensure GitHub Actions is on for the repo (Settings → Actions →
Allow all actions). No tokens required for the default jobs.

## 7. Replit Deployments

The `.replit` and `replit.deploy.toml` files at the repo root configure
the canonical deployment target. To deploy:

1. Open the project in Replit (`https://replit.com/@henri45/E-code`).
2. Set the production secrets above in the *Secrets* panel.
3. Click *Deploy* → choose *Reserved VM* or *Autoscale* (Reserved VM
   is the closest match to the single-VM mode `deploymentEngine.ts`
   was tested against).
4. After the first deploy, run the seed manually:
   ```
   replit ssh
   $ npm run db:push
   $ npx tsx server/db-seed.ts
   ```

## 8. Monitoring & on-call

Once Sentry is wired:

- Server errors will appear under the `vibe-companion` project (set
  via `SENTRY_ENVIRONMENT`).
- Client errors will tag with `release = $VITE_APP_VERSION`.
- Add an `@here` Slack alert in Sentry for `level:fatal`.

The repo has no APM / synthetic monitoring yet — pick one of
Better Stack / Pingdom / Replit's built-in uptime monitor and point
it at `GET /api/health` (returns 200 + uptime + memory) and
`GET /api/ready` (200 only when the DB is reachable).

## 9. Known debt to schedule

These are intentionally deferred:

| Item | Why deferred | When to revisit |
|---|---|---|
| ~3 781 strict-mode TypeScript errors | Pre-existing baseline; build is non-blocking | Pay down per area as touched |
| `container-orchestrator.ts` still in `server/deployment/` | Still imported by `polyglot-routes.ts` + `edge-manager.ts` | Archive when those routes are removed |
| Real-database integration tests | None at the moment | Add Playwright + Postgres-in-CI when there's bandwidth |
| Pino migration | Wrapper now does redaction + console-silencing, which were the real audit findings | Only if perf becomes a bottleneck |

## 10. Final sanity check

- [ ] `npm run dev` boots without errors locally
- [ ] `curl http://localhost:5000/api/health | jq` returns `status: healthy`
- [ ] CSP header is present on `/api/health` (run `curl -I` and grep)
- [ ] First seed prints the admin password and only once
- [ ] AI generation produces a project that imports shadcn + framer-motion
- [ ] CI is green on `main` after the first push

When all boxes are ticked, mark **production status: GO** in
`CLAUDE.md`.
