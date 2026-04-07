# Memory Bank – Tech Context

## Core Stack
- Language: TypeScript end-to-end.
- Frontend: React (likely with a router, state management via React Query/Context or similar).
- Backend: Node.js with a TypeScript framework (e.g., Express/Nest/Fastify – choose and record here).
- Database: relational (e.g., PostgreSQL) or document (e.g., MongoDB) – decide and log schema basics.

## Key Dependencies to Track
- Stripe SDK (server + client).
- Auth library (e.g., NextAuth, custom JWT/session logic, bcrypt/argon2 for passwords).
- ORM/Query builder (Prisma/TypeORM/Drizzle/Knex – record chosen tool here).
- Testing: Jest/Vitest + React Testing Library.

## Environment Variables (baseline)
- `STRIPE_SECRET_KEY` – server-side Stripe API key.
- `STRIPE_WEBHOOK_SECRET` – to verify payment webhooks.
- `STRIPE_PUBLISHABLE_KEY` – frontend key.
- `DATABASE_URL` – connection string.
- `SESSION_SECRET` / `JWT_SECRET` – auth security.
- `APP_BASE_URL` – for redirects, webhooks.

## Dev Setup Notes
- Single repo (monorepo or single app) with shared `types` for API contracts.
- Local dev: run backend + frontend with hot reload; use Stripe test keys.
- Use migrations for DB schema evolution; track breaking changes here.
