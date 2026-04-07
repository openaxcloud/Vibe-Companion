# Tech Context & Setup – Memory Bank

## Core Stack
- Language: TypeScript end-to-end.
- Frontend: React, React Router, state management (e.g., Redux Toolkit or React Query + local state).
- Backend: Node.js (TypeScript) with an HTTP framework (e.g., Express/Fastify).
- Database: Postgres with migration tool (e.g., Prisma or Knex).

## Key Dependencies to Track
- Stripe: `stripe` Node SDK, `@stripe/stripe-js` and `@stripe/react-stripe-js` on frontend.
- Auth: JWT library, password hashing (bcrypt/argon2).
- Validation: schema-based (e.g., Zod/Yup) shared between client and server where possible.

## Environment Variables (Examples)
- `DATABASE_URL` – Postgres connection string.
- `STRIPE_SECRET_KEY` – server-side secret.
- `STRIPE_PUBLISHABLE_KEY` – client-side key.
- `STRIPE_WEBHOOK_SECRET` – validates incoming webhooks.
- `JWT_SECRET` – token signing key.
- `APP_BASE_URL` / `FRONTEND_URL` – used for redirects (checkout success/cancel).

## Dev Setup Notes
- Use Docker (optional) for local Postgres.
- Single repo (monorepo optional) containing frontend and backend packages.
- Shared `types` package for DTOs and API contracts where feasible.
