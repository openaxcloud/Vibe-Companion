# Vibe-Companion / E-code

A Replit-style cloud IDE that **generates production-grade web apps from
natural-language prompts** — modern design system (shadcn/ui + Framer
Motion + dark mode), live preview with hot-reload, and a multi-provider
agentic AI pipeline (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5, with
GPT-4.1, Gemini 2.5, Grok-3 and Kimi-K2 as fallbacks).

## Quickstart

```bash
git clone https://github.com/openaxcloud/Vibe-Companion.git
cd Vibe-Companion
cp .env.example .env                        # then fill in DATABASE_URL + at least one *_API_KEY
npm install
npm run db:push                             # apply Drizzle schema to your Postgres
npm run dev                                 # http://localhost:5000
```

The first run seeds an `admin@test.com` account and prints its randomly
generated password to stdout — copy it.

### Required env vars

See [`.env.example`](.env.example) for development and
[`.env.production.example`](.env.production.example) for production.
Minimum to boot:

| Variable | Why |
|---|---|
| `DATABASE_URL` | Postgres for app data + session store |
| `SESSION_SECRET` | Cookie signing — random 32+ chars |
| `ENCRYPTION_KEY` | At-rest secret encryption — random 32+ chars |
| `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY` | At least one AI provider |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Boot the server in dev mode (Vite HMR + tsx watch) |
| `npm run build` | Typecheck (non-blocking) + bundle for production |
| `npm start` | Run the production build (`dist/index.cjs`) |
| `npm run lint` | ESLint server + client (max 50 warnings) |
| `npm run check` | Full TypeScript check (`tsc --noEmit`) |
| `npm test` | Vitest unit tests |
| `npm run db:push` | Apply Drizzle schema migrations |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the request →
generation → preview pipeline, the AI fallback chain, and the post-
processing stage (prettier + eslint --fix + tsc).

## Production deployment

The canonical target is **Replit Deployments**. See
[`.env.production.example`](.env.production.example) for the full set
of production-grade env vars and
[`docs/HANDOFF.md`](docs/HANDOFF.md) for the operational checklist
(third-party accounts, secrets, monitoring).

Alternative deployment strategies (Kubernetes, blue/green, buildpack…)
are preserved in [`archive/deploy-strategies/`](archive/deploy-strategies/)
but not part of the active runtime path.

## Project status

See [`CLAUDE.md`](CLAUDE.md) for the live status board (audit results,
phase-by-phase modernization progress, and known gaps).

## License

MIT — see [`LICENSE`](LICENSE) (or `package.json` `license` field).
