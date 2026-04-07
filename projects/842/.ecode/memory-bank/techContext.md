# Memory Bank – Tech Context & Setup

## Core Stack
- Language: TypeScript across front-end and back-end.
- Front-end: React (with router, state management solution, and UI library TBD).
- Back-end: Node.js with an HTTP framework (e.g., Express/Fastify/Nest) exposing REST APIs.
- Database: Relational DB (likely Postgres) for products, users, orders, and carts.

## Key Integrations
- Stripe: payments, webhooks, potentially customer objects and saved payment methods.
- Authentication: JWT or session-based auth; password hashing (bcrypt or argon2); optional OAuth in future.

## Build & Dev Environment
- Package manager: npm or pnpm (decide and record here).
- Monorepo or separate repos: document chosen layout and path conventions.
- Scripts for dev, test, lint, type-check, and database migrations.

## Env Vars to Track
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `DATABASE_URL` (Postgres), `SESSION_SECRET`/`JWT_SECRET`.
- `NODE_ENV`, `PORT`, `FRONTEND_URL`, `BACKEND_URL`.

## Dependencies to Remember
- React ecosystem: router, query/data fetching, state management, UI kit.
- Backend: validation library, ORM (Prisma/TypeORM/Knex), Stripe SDK, logging lib.
- Testing: unit test runner + API/integration test setup.
