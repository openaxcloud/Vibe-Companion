# Architecture — Vibe-Companion / E-code

One-page snapshot of the request → generation → preview pipeline.

## High-level flow

```
┌─────────────┐    1. prompt      ┌────────────────────┐
│   Browser   │ ────────────────► │  Express server    │
│  (React +   │ ◄──────────────── │  (server/index.ts) │
│   shadcn)   │   SSE stream      └─────────┬──────────┘
└─────────────┘                             │
                                            │ 2. createGeneration()
                                            ▼
                              ┌──────────────────────────────┐
                              │  ai-provider-manager.ts       │
                              │  ─ fallback chain:            │
                              │    Opus 4.7 → Sonnet 4.6      │
                              │    → GPT-4.1 → Gemini 2.5     │
                              │    → Grok-3 → Kimi-K2         │
                              │  ─ circuit breakers           │
                              │  ─ prompt cache (Anthropic)   │
                              │  ─ stream limiter (10MB/60s)  │
                              └─────────┬────────────────────┘
                                        │ 3. stream tokens
                                        ▼
                              ┌──────────────────────────────┐
                              │  modern-design-system.ts +   │
                              │  agent-system-prompt.ts      │
                              │  inject shadcn/Framer Motion │
                              │  patterns into the prompt    │
                              └─────────┬────────────────────┘
                                        │ 4. files written
                                        ▼
                              ┌──────────────────────────────┐
                              │  post-processing.ts           │
                              │  ─ prettier --write           │
                              │  ─ eslint --fix (non-block)   │
                              │  ─ tsc --noEmit (retry x2 if  │
                              │    errors → re-prompt LLM)    │
                              └─────────┬────────────────────┘
                                        │ 5. project files saved
                                        ▼
                              ┌──────────────────────────────┐
                              │  preview-service.ts           │
                              │  ─ detects framework          │
                              │  ─ spawns dev server          │
                              │  ─ proxies via /api/preview/  │
                              │    projects/:id/preview/*     │
                              └─────────┬────────────────────┘
                                        │ 6. iframe URL
                                        ▼
                                  ┌─────────┐
                                  │  Live   │
                                  │ preview │  (with auto-fix loop:
                                  │ iframe  │   silent retry up to 3
                                  └─────────┘   times, then UI banner)
```

## Key modules

### Server (`server/`)

| Module | Responsibility |
|---|---|
| `index.ts` | Express bootstrap — Helmet (CSP+HSTS), CORS, sessions, monitoring, route registration |
| `routes.ts` | Top-level HTTP router (legacy + modular) |
| `routes/` | Domain routers (agent, AI, code-review, deployment, …) |
| `middleware/session-config.ts` | PostgreSQL-backed express-session (`user_sessions` table) |
| `ai/ai-provider-manager.ts` | Multi-provider AI gateway with fallback chain + circuit breakers |
| `ai/prompts/` | System prompts (agent, modern design, design-system) |
| `ai/post-processing.ts` | prettier + eslint + tsc pipeline applied to every generation |
| `preview/preview-service.ts` | Per-project dev server + reverse proxy for live preview |
| `services/deployment-manager.ts` | Replit-style deployment orchestrator (single-VM target) |
| `utils/logger.ts` | Wrapper with secret redaction + console silencing in production |
| `monitoring.ts` | Sentry bootstrap (soft dep, opt-in via `SENTRY_DSN`) |

### Client (`client/src/`)

| Module | Responsibility |
|---|---|
| `App.tsx` | Wouter router + React Query + auth gating |
| `components/editor/UnifiedIDELayout.tsx` | Main IDE shell (file tree, editor, AI panel, preview) |
| `components/editor/ResponsiveWebPreview.tsx` | Live preview iframe with build-error auto-fix loop and stop-after-3-fails safety |
| `components/ai/` | Streaming chat UI, plan-mode proposals, tool-execution display |
| `lib/sentry.ts` | Client-side Sentry bootstrap (soft dep, opt-in via `VITE_SENTRY_DSN`) |

### Shared (`shared/`)

Drizzle schemas (`schema.ts`), pricing tables (`MODEL_TOKEN_PRICING`),
agent mode definitions (`AGENT_MODE_MODELS`).

## AI fallback chain

Defined in `server/ai/ai-provider-manager.ts:62-69`:

1. `claude-opus-4-7` — primary, 1M context, best agentic coding
2. `claude-sonnet-4-6` — top price-performance fallback
3. `gpt-4.1` — OpenAI flagship
4. `gemini-2.5-pro` — Google flagship
5. `grok-3` — xAI
6. `kimi-k2` — Moonshot

Cheap/fast tier (autocomplete, short ops): `claude-haiku-4-5-20251001`.

A circuit breaker wraps each provider — if a provider returns 3 errors
in a 60-second window, it's skipped for the next 20 seconds.

## Session & security

- Sessions: `connect-pg-simple` against the `user_sessions` table —
  persistent across restarts, fail-fast if `DATABASE_URL` is missing in
  production.
- CSP whitelists `'self'` + AI provider endpoints + Vite HMR (dev
  only); HSTS 1 year + `includeSubDomains` + `preload` in production.
- All passwords hashed via `bcrypt-compat` (cost 12) — see
  `server/auth.router.ts`.
- Console output is silenced in production (`silenceConsoleInProduction()`
  at the top of `server/index.ts`); `console.warn`/`console.error`
  routed through the secret-redacting logger to stderr so deployment
  platforms still see them.

## What lives in `archive/`

`archive/deploy-strategies/` contains 13 dormant deployment modules
(blue/green, k8s, buildpack, autoscale, multi-region failover, A/B,
…) that were prototyped but never wired into the runtime path. They
are kept for historical reference; `tsconfig.json` excludes the
directory from typecheck.

## Migration baseline

The repo currently carries ~3 800 pre-existing TypeScript errors
(strict mode + legacy code). The build pipeline does a non-blocking
`tsc --noEmit` with a 15-second timeout (`script/build.ts:21-25`)
to keep CI green while the debt is paid down.
