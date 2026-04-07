# Tech Stack & Setup (Memory Bank)

## Core Stack
- Language: TypeScript (front-end and back-end).
- Front-end: React (with modern tooling: Vite/Next-like bundler, React Router or built-in routing).
- Back-end: Node.js TypeScript server (Express/Fastify/Nest-style) exposing JSON APIs.
- Database: Postgres (or similar SQL) with migration tooling.
- Auth: JWT or session cookies with secure HTTP-only cookies.
- Payments: Stripe (Payment Intents API + webhooks).

## Key Dependencies (initial)
- React, React Router (if SPA); state/query library (e.g., React Query-style) for async data.
- Form handling & validation (e.g., React Hook Form + zod-like schema validation).
- Server framework (Express/Fastify or Nest-like), Stripe SDK.
- ORM/Query builder (Prisma/TypeORM/knex-style) for DB access.

## Environment Variables (baseline list)
- `DATABASE_URL` – DB connection string.
- `PORT` – API server port.
- `NODE_ENV` – `development` | `production`.
- `STRIPE_SECRET_KEY` – secret API key.
- `STRIPE_WEBHOOK_SECRET` – for verifying webhooks.
- `STRIPE_PUBLISHABLE_KEY` – front-end Stripe key.
- `SESSION_SECRET` or `JWT_SECRET` – auth token/signing secret.
- `APP_BASE_URL` – public base URL for redirects and webhooks.
