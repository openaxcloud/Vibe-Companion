# Tech Context & Environment – Memory Bank

## Stack Summary
- Language: TypeScript end‑to‑end.
- Frontend: React, React Router, React Query (or SWR), component library or custom UI.
- Backend: Node.js with a TypeScript framework (e.g., Express/Fastify/Nest – pick one and document), REST API.
- Database: Postgres (via Prisma or another TypeScript ORM).
- Payments: Stripe (Checkout or Payment Intents + Webhooks).

## Project Structure (Planned)
- `/frontend`: React SPA with routing for catalog, cart, checkout, auth, dashboard.
- `/backend`: API server, Stripe integration, auth, and DB access.
- `/shared` (optional): shared types/interfaces between FE/BE.

## Key Dependencies to Track
- FE: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, a UI library (e.g., `mui`, `chakra`, or Tailwind + headless UI).
- BE: `express`/`fastify`/`nest`, `zod`/`yup` for validation, `prisma` (or ORM), `jsonwebtoken`, `stripe` SDK.
- Tooling: `typescript`, `ts-node`/build tool, `eslint`, `prettier`, `vitest`/`jest`/`testing-library` for tests.

## Environment Variables (Initial Set)
- `DATABASE_URL` – connection string for Postgres.
- `STRIPE_SECRET_KEY` – server‑side Stripe secret key.
- `STRIPE_WEBHOOK_SECRET` – secret for verifying webhooks.
- `STRIPE_PUBLISHABLE_KEY` – public key used in frontend.
- `JWT_SECRET` (or session secret) – for authentication.
- `APP_BASE_URL` – public URL for redirects and webhook config.

## Dev & Build Notes
- Use `.env.local` for local dev, never commit secrets.
- Scripts for `dev`, `test`, `lint`, `build`, and separate FE/BE start commands.
- Consider Docker for DB and local infra, but not mandatory for v1.

## Memory Notes
- Keep TypeScript configs strict to catch issues early.
- Align Node/TS versions across services to avoid type/runtime drift.
