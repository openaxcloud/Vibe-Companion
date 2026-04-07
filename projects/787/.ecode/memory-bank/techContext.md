# Memory Bank – Tech Stack & Dev Setup

## Core Stack
- Language: TypeScript across frontend and backend.
- Frontend: React, React Router (or framework router), component library (e.g., Tailwind + Headless UI or similar).
- Backend: Node.js (TypeScript) HTTP server (e.g., Express/Fastify/Nest).
- Database: PostgreSQL for relational, multi-tenant data.
- Payments: Stripe (Checkout + Customer Portal + Webhooks).

## Key Dependencies
- Auth: bcrypt/argon2 for password hashing, JWT/session library, CSRF protection for web.
- ORM: Prisma or TypeORM for schema management and typed DB access.
- Validation: Zod/Yup for request and form validation.
- HTTP: Axios/fetch wrappers with typed clients.
- Tooling: ESLint, Prettier, Jest/Vitest, React Testing Library.

## Development Setup
- Single repo with `frontend/` and `backend/` or a monorepo with shared types.
- Scripts: `dev` (concurrent frontend/backend), `db:migrate`, `db:seed`, `test`, `lint`.
- Local Stripe CLI integration for testing webhooks.

## Environment Variables (examples)
- `DATABASE_URL` – PostgreSQL connection string.
- `JWT_SECRET` / session secrets.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_PRICE_...` per pricing tier.
- `APP_URL`, `FRONTEND_URL`, `BACKEND_URL`.
