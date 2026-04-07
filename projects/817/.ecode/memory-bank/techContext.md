# Tech Context – Memory Bank

## Stack Decisions
- Language: TypeScript across frontend and backend.
- Frontend: React (likely with Vite or Next.js; record once chosen), component-level state + global store (e.g., Redux/RTK, Zustand, or React Query + local state).
- Backend: Node.js with a TypeScript framework (e.g., NestJS/Express/Fastify), REST API.
- Database: PostgreSQL with migration tooling (Prisma, TypeORM, or Knex – to be locked in and recorded).
- Payments: Stripe SDK (server + client) with Payment Intents and Webhooks.

## Development Setup (Expected)
- Monorepo or multi-package structure: `/frontend`, `/backend`, shared types in `/shared` for DTOs and models.
- Tooling: ESLint, Prettier, Jest/Vitest, React Testing Library for core flows.
- Local dev via Docker for DB and Stripe CLI for webhook testing.

## Key Dependencies (to track explicitly)
- `react`, `react-dom`, chosen router (e.g., `react-router-dom` or Next router).
- `@stripe/stripe-js`, `@stripe/react-stripe-js` on frontend.
- `stripe` Node SDK on backend.
- Auth library (e.g., `passport`, `next-auth` if Next, or custom JWT/session implementation).
- ORM/migration tool (e.g., `prisma` or `typeorm`).

## Environment Variables (Minimum Set)
- `DATABASE_URL` – connection string for Postgres.
- `STRIPE_SECRET_KEY` – server-side secret key.
- `STRIPE_PUBLISHABLE_KEY` – client-side publishable key.
- `STRIPE_WEBHOOK_SECRET` – to verify incoming Stripe webhooks.
- `SESSION_SECRET` or `JWT_SECRET` – for auth.
- `APP_BASE_URL` and `STRIPE_WEBHOOK_URL` (or derived) for callback routing.

## Platform / Deployment Notes
- Intended deployment: one Node.js backend service, one Postgres instance, static frontend hosting (or integrated if using Next.js).
- Logging/monitoring to be minimal but structured (e.g., `pino`/`winston`), especially around checkout and webhooks.