# Tech Context & Setup – Memory Bank

## Core Tech Stack
- Language: TypeScript end-to-end.
- Front-end: React (with hooks), router (e.g., React Router), state management (React Query/RTK/Context).
- Backend: Node.js + Express/Nest/Fastify (to be chosen and recorded here).
- Database: Postgres (via Prisma/TypeORM/knex).
- Payments: Stripe (Checkout or Payment Intents API).

## Key Dependencies (to track here)
- React ecosystem: router, form library (e.g., React Hook Form), UI kit (e.g., MUI/Tailwind).
- Validation: Zod/Yup for shared schemas.
- Auth: passport/next-auth/custom JWT middleware (decision to be captured).
- Testing: Jest/React Testing Library and backend test framework.

## Environment & Configuration
- Env vars (examples to refine):
  - `DATABASE_URL`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
  - `SESSION_SECRET` or JWT secret
  - `FRONTEND_URL`, `BACKEND_URL`
- Local dev via docker-compose (DB, optional Stripe CLI for webhooks).
- Node version and package manager (npm/yarn/pnpm) pinned and recorded.
